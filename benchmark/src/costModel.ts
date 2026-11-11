import type { CostAssumptions, LipsyncProviderId, LipsyncRate, Pricing, VendorRates } from "./config.js";

/** Splits a duration into provider-sized chunks (e.g. Kling accepts at most 10 s per job). */
export function splitIntoChunks(seconds: number, maxChunkSeconds?: number): number[] {
  if (!maxChunkSeconds || seconds <= maxChunkSeconds) return [seconds];
  const chunks: number[] = [];
  let remaining = seconds;
  while (remaining > 0) {
    chunks.push(Math.min(remaining, maxChunkSeconds));
    remaining -= maxChunkSeconds;
  }
  return chunks;
}

function singleJobCost(rate: LipsyncRate, seconds: number): number {
  switch (rate.kind) {
    case "perSecond":
      return rate.usdPerSecond * seconds;
    case "flatThenPerSecond":
      return seconds <= rate.flatMaxSeconds ? rate.flatUsd : rate.usdPerSecondAfter * seconds;
    case "perIncrement": {
      const billedSeconds = Math.ceil(seconds / rate.incrementSeconds) * rate.incrementSeconds;
      return billedSeconds * rate.usdPerSecond;
    }
  }
}

/** Cost of lip-syncing `seconds` of output video, chunking when the provider caps input length. */
export function lipsyncCost(rate: LipsyncRate, seconds: number): number {
  if (!(seconds > 0)) throw new Error(`lipsyncCost: seconds must be > 0, got ${seconds}`);
  return splitIntoChunks(seconds, rate.maxInputSeconds).reduce((sum, chunk) => sum + singleJobCost(rate, chunk), 0);
}

export function ttsCost(rates: VendorRates, chars: number): number {
  return (chars / 1000) * rates.tts.usdPer1kChars;
}

export function claudeCost(rates: VendorRates, inputTokens: number, outputTokens: number): number {
  return (inputTokens * rates.claude.usdPerMInput + outputTokens * rates.claude.usdPerMOutput) / 1_000_000;
}

export function stripeFee(rates: VendorRates, amountUsd: number): number {
  return amountUsd * rates.stripe.pct + rates.stripe.fixedUsd;
}

const perDeliveryOverhead = (rates: VendorRates) => rates.email.usdPerEmail * 2 + rates.storage.usdPerVideoDelivered;

export interface ModelInputs {
  rates: VendorRates;
  pricing: Pricing;
  assumptions: CostAssumptions;
}

/** One greeting clip for one name (TTS + lip-sync), single take. */
export function nameClipCost({ rates, assumptions }: ModelInputs, provider: LipsyncProviderId): number {
  const { seconds, greetingChars } = assumptions.nameClip;
  return lipsyncCost(rates.lipsync[provider], seconds) + ttsCost(rates, greetingChars);
}

/** One-off cost of pre-rendering the whole name library for one language, retakes included. */
export function libraryCost(inputs: ModelInputs, provider: LipsyncProviderId, language: "en" | "fr"): number {
  const { namesPerLanguage } = inputs.assumptions.library;
  return namesPerLanguage[language] * inputs.assumptions.nameClip.takesPerName * nameClipCost(inputs, provider);
}

export function totalLibraryCost(inputs: ModelInputs, provider: LipsyncProviderId): number {
  return libraryCost(inputs, provider, "en") + libraryCost(inputs, provider, "fr");
}

/**
 * Variable cost of delivering one instant video (B2C or business), with the
 * library cost amortized over `videosDelivered`. Excludes payment fees.
 */
export function instantVideoCost(inputs: ModelInputs, provider: LipsyncProviderId, videosDelivered: number): number {
  if (!(videosDelivered > 0)) throw new Error("videosDelivered must be > 0");
  const amortizedLibrary = totalLibraryCost(inputs, provider) / videosDelivered;
  const rareNames = inputs.assumptions.instant.rareNameShare * nameClipCost(inputs, provider);
  return amortizedLibrary + rareNames + perDeliveryOverhead(inputs.rates);
}

export type CustomStrategy = "fullLipsync" | "personalizedOnly";

/** Variable cost of one custom video. Excludes payment fees. */
export function customVideoCost(inputs: ModelInputs, provider: LipsyncProviderId, strategy: CustomStrategy): number {
  const { rates } = inputs;
  const c = inputs.assumptions.custom;
  const lipsyncSeconds = strategy === "fullLipsync" ? c.spokenSeconds : c.personalizedSeconds;
  const scriptAndModeration =
    claudeCost(rates, c.scriptTokens.input, c.scriptTokens.output) +
    c.moderationCallsPerOrder * claudeCost(rates, c.moderationTokens.input, c.moderationTokens.output);
  const voice = ttsCost(rates, c.scriptChars) + c.previewsPerPurchase * ttsCost(rates, c.previewChars);
  return scriptAndModeration + voice + lipsyncCost(rates.lipsync[provider], lipsyncSeconds) + perDeliveryOverhead(rates);
}

export interface MarginLine {
  priceUsd: number;
  costUsd: number;
  marginUsd: number;
  marginPct: number;
}

export function margin(rates: VendorRates, priceUsd: number, variableCostUsd: number): MarginLine {
  const costUsd = variableCostUsd + stripeFee(rates, priceUsd);
  const marginUsd = priceUsd - costUsd;
  return { priceUsd, costUsd, marginUsd, marginPct: marginUsd / priceUsd };
}

/** Margin on a business package if every child slot is used. */
export function businessPackageMargin(
  inputs: ModelInputs,
  provider: LipsyncProviderId,
  pkg: { priceUsd: number; children: number },
  videosDelivered: number,
): MarginLine {
  const videoCosts = pkg.children * instantVideoCost(inputs, provider, videosDelivered);
  return margin(inputs.rates, pkg.priceUsd, videoCosts);
}

/** Margin on a custom upgrade bought from a business page, after the business's revenue share. */
export function businessReferredCustomMargin(
  inputs: ModelInputs,
  provider: LipsyncProviderId,
  strategy: CustomStrategy,
): MarginLine {
  const price = inputs.pricing.products.custom.priceUsd;
  const share = price * inputs.pricing.businessRevenueShare;
  return margin(inputs.rates, price, customVideoCost(inputs, provider, strategy) + share);
}
