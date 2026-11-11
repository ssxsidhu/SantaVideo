import Stripe from "stripe";

/**
 * Stripe webhook logic, kept free of Next/DB imports so it can be unit-tested with fakes.
 * Safe under redelivery: the store's markOrderPaid is idempotent and the queue dedupes by video id.
 */

export type MarkPaidOutcome = "paid" | "unknownOrder" | "amountMismatch" | "sessionMismatch" | "notPayable";

export interface MarkPaidInput {
  orderId: string;
  sessionId: string;
  amountMinor: number;
  currency: string;
  /** Already encrypted; plaintext email never reaches the store. */
  emailEnc: string | null;
  eventId: string;
  eventType: string;
}

export interface PaymentStore {
  markOrderPaid(input: MarkPaidInput): Promise<{ outcome: MarkPaidOutcome; firstDelivery: boolean; videoIds: string[] }>;
}

export interface RenderEnqueuer {
  enqueue(videoId: string): Promise<void>;
}

export type WebhookResult =
  | { status: "ignored"; reason: string }
  | { status: "rejected"; reason: MarkPaidOutcome | "badOrderReference" }
  | { status: "processed"; firstDelivery: boolean; enqueued: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

export async function handleStripeEvent(
  event: Stripe.Event,
  deps: { store: PaymentStore; queue: RenderEnqueuer; encryptEmail: (email: string) => string },
): Promise<WebhookResult> {
  if (!PAID_EVENTS.has(event.type)) return { status: "ignored", reason: `unhandled type ${event.type}` };

  const session = event.data.object as Stripe.Checkout.Session;
  // "completed" also fires for delayed methods that haven't paid yet; those arrive later as async_payment_succeeded.
  if (session.payment_status !== "paid") return { status: "ignored", reason: "not paid yet" };

  const orderId = session.client_reference_id ?? session.metadata?.orderId ?? "";
  if (!UUID.test(orderId)) return { status: "rejected", reason: "badOrderReference" };

  const email = session.customer_details?.email;
  const result = await deps.store.markOrderPaid({
    orderId,
    sessionId: session.id,
    // The subtotal is our price before discounts and tax. amount_total differs legitimately: Managed Payments adds
    // sales tax on top and promotion codes lower it. Adaptive Pricing keeps both in our currency (local amount is
    // in presentment_details), so the subtotal must equal the order price exactly.
    amountMinor: session.amount_subtotal ?? -1,
    currency: (session.currency ?? "").toLowerCase(),
    emailEnc: email ? deps.encryptEmail(email) : null,
    eventId: event.id,
    eventType: event.type,
  });
  if (result.outcome !== "paid") return { status: "rejected", reason: result.outcome };

  for (const videoId of result.videoIds) await deps.queue.enqueue(videoId);
  return { status: "processed", firstDelivery: result.firstDelivery, enqueued: result.videoIds.length };
}

/** Verifies the Stripe-Signature header against the raw body. Throws on any mismatch or a stale timestamp. */
export function verifyStripeEvent(rawBody: string, signature: string | null, secret: string | undefined): Stripe.Event {
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  if (!signature) throw new Error("Missing Stripe-Signature header");
  return Stripe.webhooks.constructEvent(rawBody, signature, secret);
}
