import { NextResponse } from "next/server";
import { encryptSecret } from "@santa/core";
import { postgresPaymentStore } from "@/server/orders";
import { bullRenderEnqueuer } from "@/server/queue";
import { handleStripeEvent, verifyStripeEvent } from "@/server/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let event;
  try {
    event = verifyStripeEvent(rawBody, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event, {
      store: postgresPaymentStore,
      queue: bullRenderEnqueuer,
      encryptEmail: (email) => encryptSecret(email),
    });
    // Event id and outcome only; the session object holds the parent's email.
    console.log(`stripe webhook ${event.id} ${event.type}: ${result.status}${"reason" in result ? ` (${result.reason})` : ""}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    // 500 makes Stripe retry; the handler is idempotent, so a retry finishes the job.
    console.error(`stripe webhook ${event.id} failed:`, error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
