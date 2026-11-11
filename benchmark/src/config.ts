import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export type LipsyncProviderId =
  | "sync-lipsync-2"
  | "sync-lipsync-2-pro"
  | "sync-3"
  | "fal-latentsync"
  | "fal-kling-lipsync";

interface RateBase {
  label: string;
  source: string;
  /** Provider rejects inputs longer than this; longer jobs are split into chunks. */
  maxInputSeconds?: number;
}

export type LipsyncRate = RateBase &
  (
    | { kind: "perSecond"; usdPerSecond: number }
    | { kind: "flatThenPerSecond"; flatUsd: number; flatMaxSeconds: number; usdPerSecondAfter: number }
    | { kind: "perIncrement"; usdPerSecond: number; incrementSeconds: number }
  );

export interface VendorRates {
  retrieved: string;
  lipsync: Record<LipsyncProviderId, LipsyncRate>;
  tts: { usdPer1kChars: number };
  claude: { model: string; usdPerMInput: number; usdPerMOutput: number };
  stripe: { pct: number; fixedUsd: number };
  email: { usdPerEmail: number };
  storage: { usdPerVideoDelivered: number };
}

export interface BusinessPackage {
  priceUsd: number;
  children: number;
}

export interface Pricing {
  products: {
    instant: { priceUsd: number };
    custom: { priceUsd: number };
    businessSmall: BusinessPackage;
    businessStandard: BusinessPackage;
    businessLarge: BusinessPackage;
  };
  businessRevenueShare: number;
}

interface TokenUsage {
  input: number;
  output: number;
}

export interface CostAssumptions {
  nameClip: { seconds: number; greetingChars: number; takesPerName: number };
  library: { namesPerLanguage: Record<"en" | "fr", number> };
  instant: { rareNameShare: number };
  custom: {
    spokenSeconds: number;
    scriptChars: number;
    personalizedSeconds: number;
    previewChars: number;
    previewsPerPurchase: number;
    scriptTokens: TokenUsage;
    moderationTokens: TokenUsage;
    moderationCallsPerOrder: number;
  };
  amortizationScenarios: number[];
}

function readJson<T>(relativePath: string): T {
  const fullPath = join(REPO_ROOT, relativePath);
  try {
    return JSON.parse(readFileSync(fullPath, "utf8")) as T;
  } catch (error) {
    throw new Error(`Failed to load config ${relativePath}: ${(error as Error).message}`);
  }
}

function assertPositive(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Config value ${path} must be a positive number, got ${String(value)}`);
  }
}

export function loadConfig(): { rates: VendorRates; pricing: Pricing; assumptions: CostAssumptions } {
  const rates = readJson<VendorRates>("config/vendor-rates.json");
  const pricing = readJson<Pricing>("config/pricing.json");
  const assumptions = readJson<CostAssumptions>("config/cost-assumptions.json");

  for (const [name, product] of Object.entries(pricing.products)) {
    assertPositive(product.priceUsd, `pricing.products.${name}.priceUsd`);
  }
  assertPositive(rates.tts.usdPer1kChars, "rates.tts.usdPer1kChars");
  assertPositive(assumptions.nameClip.seconds, "assumptions.nameClip.seconds");
  if (assumptions.amortizationScenarios.length === 0) {
    throw new Error("assumptions.amortizationScenarios must not be empty");
  }
  return { rates, pricing, assumptions };
}
