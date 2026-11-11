import Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";
import { handleStripeEvent, verifyStripeEvent, type MarkPaidInput, type PaymentStore } from "./webhook";

const ORDER_ID = "4f9c2a1e-8b7d-4c3e-9a1f-2b3c4d5e6f70";
const VIDEO_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const SECRET = "whsec_test_secret";

/** In-memory store with the same rules as the Postgres one: pending -> paid once, amount + session must match. */
class FakeStore implements PaymentStore {
  order = { status: "pending" as string, amountMinor: 599, currency: "usd", sessionId: null as string | null, emailEnc: null as string | null };
  videoStatus = "awaiting_payment";
  events = new Set<string>();
  paidTransitions = 0;

  async markOrderPaid(input: MarkPaidInput) {
    const firstDelivery = !this.events.has(input.eventId);
    this.events.add(input.eventId);
    if (input.orderId !== ORDER_ID) return { outcome: "unknownOrder" as const, firstDelivery, videoIds: [] };
    if (input.amountMinor !== this.order.amountMinor || input.currency !== this.order.currency) {
      return { outcome: "amountMismatch" as const, firstDelivery, videoIds: [] };
    }
    if (this.order.sessionId && this.order.sessionId !== input.sessionId) {
      return { outcome: "sessionMismatch" as const, firstDelivery, videoIds: [] };
    }
    if (this.order.status === "pending") {
      this.order = { ...this.order, status: "paid", sessionId: input.sessionId, emailEnc: input.emailEnc };
      this.videoStatus = "queued";
      this.paidTransitions += 1;
    } else if (this.order.status !== "paid") {
      return { outcome: "notPayable" as const, firstDelivery, videoIds: [] };
    }
    return { outcome: "paid" as const, firstDelivery, videoIds: this.videoStatus === "queued" ? [VIDEO_ID] : [] };
  }
}

/** Queue fake that dedupes by job id like BullMQ does. */
class FakeQueue {
  jobs = new Set<string>();
  calls = 0;
  async enqueue(videoId: string) {
    this.calls += 1;
    this.jobs.add(videoId);
  }
}

function sessionEvent(overrides: Partial<Stripe.Checkout.Session> = {}, type = "checkout.session.completed", id = "evt_1"): Stripe.Event {
  return {
    id,
    type,
    object: "event",
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        client_reference_id: ORDER_ID,
        metadata: { orderId: ORDER_ID },
        payment_status: "paid",
        amount_subtotal: 599,
        amount_total: 599,
        currency: "usd",
        customer_details: { email: "parent@example.com" },
        ...overrides,
      },
    },
  } as unknown as Stripe.Event;
}

describe("handleStripeEvent", () => {
  let store: FakeStore;
  let queue: FakeQueue;
  const deps = () => ({ store, queue, encryptEmail: (e: string) => `enc(${e.length})` });

  beforeEach(() => {
    store = new FakeStore();
    queue = new FakeQueue();
  });

  it("marks the order paid, stores only the encrypted email and enqueues the video", async () => {
    const result = await handleStripeEvent(sessionEvent(), deps());
    expect(result).toEqual({ status: "processed", firstDelivery: true, enqueued: 1 });
    expect(store.order.status).toBe("paid");
    expect(store.order.emailEnc).toBe("enc(18)");
    expect([...queue.jobs]).toEqual([VIDEO_ID]);
  });

  it("is idempotent when Stripe redelivers the same event", async () => {
    await handleStripeEvent(sessionEvent(), deps());
    const again = await handleStripeEvent(sessionEvent(), deps());
    expect(again).toMatchObject({ status: "processed", firstDelivery: false });
    expect(store.paidTransitions).toBe(1);
    expect(queue.jobs.size).toBe(1); // re-enqueue is harmless: same job id
  });

  it("recovers when enqueueing failed on the first delivery", async () => {
    const failing = { enqueue: async () => Promise.reject(new Error("redis down")) };
    await expect(handleStripeEvent(sessionEvent(), { ...deps(), queue: failing })).rejects.toThrow("redis down");
    const retry = await handleStripeEvent(sessionEvent(), deps());
    expect(retry).toMatchObject({ status: "processed", enqueued: 1 });
    expect(store.paidTransitions).toBe(1);
  });

  it("treats completed and async_payment_succeeded for the same session as one payment", async () => {
    await handleStripeEvent(sessionEvent(), deps());
    await handleStripeEvent(sessionEvent({}, "checkout.session.async_payment_succeeded", "evt_2"), deps());
    expect(store.paidTransitions).toBe(1);
  });

  it("ignores sessions that are not paid yet and unrelated event types", async () => {
    expect(await handleStripeEvent(sessionEvent({ payment_status: "unpaid" }), deps())).toMatchObject({ status: "ignored" });
    expect(await handleStripeEvent(sessionEvent({}, "payment_intent.created"), deps())).toMatchObject({ status: "ignored" });
    expect(store.order.status).toBe("pending");
    expect(queue.calls).toBe(0);
  });

  it("accepts the order price when Managed Payments adds sales tax on top", async () => {
    const taxed = sessionEvent({ amount_subtotal: 599, amount_total: 652 });
    expect(await handleStripeEvent(taxed, deps())).toMatchObject({ status: "processed" });
    expect(store.order.status).toBe("paid");
  });

  it("accepts a payment reduced by a promotion code", async () => {
    const discounted = sessionEvent({ amount_subtotal: 599, amount_total: 299 });
    expect(await handleStripeEvent(discounted, deps())).toMatchObject({ status: "processed" });
  });

  it("rejects a wrong amount or currency without marking paid", async () => {
    expect(await handleStripeEvent(sessionEvent({ amount_subtotal: 1, amount_total: 1 }), deps())).toEqual({ status: "rejected", reason: "amountMismatch" });
    expect(await handleStripeEvent(sessionEvent({ amount_subtotal: null }), deps())).toEqual({ status: "rejected", reason: "amountMismatch" });
    expect(await handleStripeEvent(sessionEvent({ currency: "eur" }), deps())).toEqual({ status: "rejected", reason: "amountMismatch" });
    expect(store.order.status).toBe("pending");
    expect(queue.calls).toBe(0);
  });

  it("rejects a session that isn't the one created for the order", async () => {
    store.order.sessionId = "cs_test_original";
    expect(await handleStripeEvent(sessionEvent({ id: "cs_test_other" }), deps())).toEqual({ status: "rejected", reason: "sessionMismatch" });
  });

  it("rejects missing or malformed order references", async () => {
    const bad = sessionEvent({ client_reference_id: "1; drop table orders", metadata: {} });
    expect(await handleStripeEvent(bad, deps())).toEqual({ status: "rejected", reason: "badOrderReference" });
  });

  it("does not resurrect refunded orders", async () => {
    store.order.status = "refunded";
    expect(await handleStripeEvent(sessionEvent(), deps())).toEqual({ status: "rejected", reason: "notPayable" });
    expect(queue.calls).toBe(0);
  });
});

describe("verifyStripeEvent", () => {
  const payload = JSON.stringify(sessionEvent());

  it("accepts a correctly signed payload", () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    expect(verifyStripeEvent(payload, header, SECRET).id).toBe("evt_1");
  });

  it("rejects a bad signature, a tampered body, a missing header or a missing secret", () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    expect(() => verifyStripeEvent(payload, header, "whsec_other")).toThrow();
    expect(() => verifyStripeEvent(payload.replace("599", "1"), header, SECRET)).toThrow();
    expect(() => verifyStripeEvent(payload, null, SECRET)).toThrow();
    expect(() => verifyStripeEvent(payload, header, undefined)).toThrow();
  });

  it("rejects replayed signatures older than the tolerance", () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET, timestamp: old });
    expect(() => verifyStripeEvent(payload, header, SECRET)).toThrow();
  });
});
