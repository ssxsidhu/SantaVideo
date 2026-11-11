import "server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    // Phase 1 runs in test mode only; refuse live keys until Phase 5.
    if (!key.startsWith("sk_test_") && process.env.STRIPE_ALLOW_LIVE !== "1") {
      throw new Error("Refusing to use a live Stripe key before launch (set STRIPE_ALLOW_LIVE=1 in Phase 5)");
    }
    client = new Stripe(key);
  }
  return client;
}

