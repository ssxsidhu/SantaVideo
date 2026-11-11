import "server-only";
import { getProductPrice, newUrlToken, type VideoLanguage } from "@santa/core";
import type { Locale } from "@santa/core/i18n";
import { and, eq, getDb, inArray, orders, stripeEvents, videos } from "@santa/db";
import type { PaymentStore } from "./webhook";

export interface NewInstantOrder {
  displayName: string;
  nameKey: string;
  language: VideoLanguage;
  locale: Locale;
}

/** Creates a pending order and its (unpaid) video. The name is stored only in videos.child_name. */
export async function createInstantOrder(input: NewInstantOrder): Promise<{ previewToken: string }> {
  const price = getProductPrice("instant");
  const previewToken = newUrlToken();
  await getDb().transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        product: "instant",
        amountMinor: price.amountMinor,
        currency: price.currency,
        locale: input.locale,
        previewToken,
        consentAt: new Date(),
      })
      .returning({ id: orders.id });
    if (!order) throw new Error("Order insert returned nothing");
    await tx.insert(videos).values({
      orderId: order.id,
      watchToken: newUrlToken(),
      childName: input.displayName,
      nameKey: input.nameKey,
      language: input.language,
    });
  });
  return { previewToken };
}

export interface PreviewRecord {
  orderId: string;
  status: (typeof orders.$inferSelect)["status"];
  amountMinor: number;
  currency: string;
  locale: Locale;
  stripeSessionId: string | null;
  childName: string;
  language: VideoLanguage;
  watchToken: string;
}

export async function findPreview(previewToken: string): Promise<PreviewRecord | undefined> {
  const rows = await getDb()
    .select({
      orderId: orders.id,
      status: orders.status,
      amountMinor: orders.amountMinor,
      currency: orders.currency,
      locale: orders.locale,
      stripeSessionId: orders.stripeSessionId,
      childName: videos.childName,
      language: videos.language,
      watchToken: videos.watchToken,
    })
    .from(orders)
    .innerJoin(videos, eq(videos.orderId, orders.id))
    .where(eq(orders.previewToken, previewToken))
    .limit(1);
  const row = rows[0];
  if (!row || !row.childName) return undefined;
  return { ...row, childName: row.childName };
}

export async function saveCheckoutSession(orderId: string, sessionId: string): Promise<void> {
  await getDb().update(orders).set({ stripeSessionId: sessionId }).where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
}

export interface WatchRecord {
  videoId: string;
  status: (typeof videos.$inferSelect)["status"];
  childName: string | null;
  finalKey: string | null;
  locale: Locale;
}

export async function findWatch(watchToken: string): Promise<WatchRecord | undefined> {
  const rows = await getDb()
    .select({
      videoId: videos.id,
      status: videos.status,
      childName: videos.childName,
      finalKey: videos.finalKey,
      locale: orders.locale,
    })
    .from(videos)
    .innerJoin(orders, eq(orders.id, videos.orderId))
    .where(eq(videos.watchToken, watchToken))
    .limit(1);
  return rows[0];
}

/** Postgres implementation of the webhook's payment store. */
export const postgresPaymentStore: PaymentStore = {
  async markOrderPaid({ orderId, sessionId, amountMinor, currency, emailEnc, eventId, eventType }) {
    return getDb().transaction(async (tx) => {
      const inserted = await tx
        .insert(stripeEvents)
        .values({ id: eventId, type: eventType })
        .onConflictDoNothing()
        .returning({ id: stripeEvents.id });

      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { outcome: "unknownOrder", firstDelivery: inserted.length > 0, videoIds: [] };
      if (order.amountMinor !== amountMinor || order.currency !== currency) {
        return { outcome: "amountMismatch", firstDelivery: inserted.length > 0, videoIds: [] };
      }
      if (order.stripeSessionId && order.stripeSessionId !== sessionId) {
        return { outcome: "sessionMismatch", firstDelivery: inserted.length > 0, videoIds: [] };
      }

      if (order.status === "pending") {
        await tx
          .update(orders)
          .set({ status: "paid", paidAt: new Date(), stripeSessionId: sessionId, emailEnc: emailEnc ?? order.emailEnc })
          .where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
        await tx
          .update(videos)
          .set({ status: "queued" })
          .where(and(eq(videos.orderId, orderId), eq(videos.status, "awaiting_payment")));
      } else if (order.status !== "paid") {
        return { outcome: "notPayable", firstDelivery: inserted.length > 0, videoIds: [] };
      }

      // Videos still waiting for the worker; re-enqueueing them is safe (one job id per video).
      const queued = await tx
        .select({ id: videos.id })
        .from(videos)
        .where(and(eq(videos.orderId, orderId), inArray(videos.status, ["queued"])));
      return { outcome: "paid", firstDelivery: inserted.length > 0, videoIds: queued.map((v) => v.id) };
    });
  },
};
