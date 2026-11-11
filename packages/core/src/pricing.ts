import pricingJson from "../../../config/pricing.json";

/** Products sold. Prices come only from config/pricing.json (owner approves any change). */
export type ProductId = "instant" | "custom" | "businessSmall" | "businessStandard" | "businessLarge";

interface PricingConfig {
  baseCurrency: string;
  products: Record<ProductId, { priceUsd: number; children?: number }>;
  businessRevenueShare: number;
  businessCampaignEndDate: string;
}

const pricing = pricingJson as unknown as PricingConfig;

export interface ProductPrice {
  product: ProductId;
  /** Lowercase ISO currency code as Stripe expects it. */
  currency: string;
  /** Smallest currency unit (cents). */
  amountMinor: number;
}

export function getProductPrice(product: ProductId): ProductPrice {
  const entry = pricing.products[product];
  if (!entry || !(entry.priceUsd > 0)) throw new Error(`No price configured for ${product}`);
  return { product, currency: pricing.baseCurrency.toLowerCase(), amountMinor: Math.round(entry.priceUsd * 100) };
}

/** Formats a price for display, e.g. "$5.99" (en) or "5,99 $ US" (fr). */
export function formatPrice(price: ProductPrice, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: price.currency.toUpperCase() }).format(
    price.amountMinor / 100,
  );
}
