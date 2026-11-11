import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { isUrlToken } from "@santa/core";
import { getMessages } from "@santa/core/i18n";
import { siteUrl } from "@/server/context";
import { findPreview, saveCheckoutSession } from "@/server/orders";
import { allowRequest, clientKey } from "@/server/rateLimit";
import { getStripe } from "@/server/stripe";

export const runtime = "nodejs";

/** Step 2: Stripe Checkout for a pending order. Reuses the open session if the parent clicks twice. */
export async function POST(request: Request) {
  if (!allowRequest(`checkout:${clientKey(request.headers)}`, 10, 60_000)) {
    return NextResponse.json({ error: "rateLimited" }, { status: 429 });
  }
  let previewToken: unknown;
  try {
    ({ previewToken } = (await request.json()) as { previewToken?: unknown });
  } catch {
    return NextResponse.json({ error: "generic" }, { status: 400 });
  }
  if (typeof previewToken !== "string" || !isUrlToken(previewToken)) {
    return NextResponse.json({ error: "generic" }, { status: 400 });
  }

  const order = await findPreview(previewToken);
  if (!order) return NextResponse.json({ error: "generic" }, { status: 404 });
  const base = siteUrl();
  if (order.status === "paid") return NextResponse.json({ url: `${base}/${order.locale}/w/${order.watchToken}` });
  if (order.status !== "pending") return NextResponse.json({ error: "generic" }, { status: 409 });

  try {
    const stripe = getStripe();
    if (order.stripeSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
      if (existing.status === "open" && existing.url) return NextResponse.json({ url: existing.url });
    }
    const t = getMessages(order.locale);
    // Managed Payments (owner decision 2026-11-11): Stripe is merchant of record and handles sales tax, which it
    // adds on top of the price. It needs an eligible product tax code (txcd_10402100, downloaded video, permanent
    // rights). Without STRIPE_PRODUCT_TAX_CODE the session opts out, so a missing env var can't break checkout.
    const taxCode = process.env.STRIPE_PRODUCT_TAX_CODE?.trim();
    const params = {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency,
            unit_amount: order.amountMinor,
            // Nothing identifying the child goes to Stripe: generic product name, order UUID as the reference.
            product_data: { name: t.checkout.productName, ...(taxCode ? { tax_code: taxCode } : {}) },
          },
        },
      ],
      client_reference_id: order.orderId,
      metadata: { orderId: order.orderId, product: "instant" },
      allow_promotion_codes: true,
      locale: order.locale,
      success_url: `${base}/${order.locale}/w/${order.watchToken}`,
      cancel_url: `${base}/${order.locale}/preview/${previewToken}`,
      // Not in this SDK version's types yet; documented in Stripe's error for accounts with Managed Payments on.
      managed_payments: { enabled: Boolean(taxCode) },
    } as Stripe.Checkout.SessionCreateParams;
    const session = await stripe.checkout.sessions.create(params);
    await saveCheckoutSession(order.orderId, session.id);
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("checkout failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "generic" }, { status: 502 });
  }
}
