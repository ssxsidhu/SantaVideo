import { describe, expect, it } from "vitest";
import type { LipsyncRate } from "./config.js";
import { loadConfig } from "./config.js";
import {
  businessReferredCustomMargin,
  customVideoCost,
  lipsyncCost,
  margin,
  splitIntoChunks,
  stripeFee,
} from "./costModel.js";

const perSecond: LipsyncRate = { label: "t", source: "t", kind: "perSecond", usdPerSecond: 0.05 };
const latentsync: LipsyncRate = {
  label: "t",
  source: "t",
  kind: "flatThenPerSecond",
  flatUsd: 0.2,
  flatMaxSeconds: 40,
  usdPerSecondAfter: 0.005,
};
const kling: LipsyncRate = {
  label: "t",
  source: "t",
  kind: "perIncrement",
  usdPerSecond: 0.014,
  incrementSeconds: 5,
  maxInputSeconds: 10,
};

describe("splitIntoChunks", () => {
  it("keeps short jobs whole", () => expect(splitIntoChunks(8, 10)).toEqual([8]));
  it("splits long jobs at the provider cap", () => expect(splitIntoChunks(25, 10)).toEqual([10, 10, 5]));
  it("ignores missing cap", () => expect(splitIntoChunks(75)).toEqual([75]));
});

describe("lipsyncCost", () => {
  it("bills per second", () => expect(lipsyncCost(perSecond, 4)).toBeCloseTo(0.2));
  it("bills LatentSync flat up to 40 s", () => {
    expect(lipsyncCost(latentsync, 3)).toBeCloseTo(0.2);
    expect(lipsyncCost(latentsync, 40)).toBeCloseTo(0.2);
  });
  it("bills LatentSync per second beyond 40 s", () => expect(lipsyncCost(latentsync, 75)).toBeCloseTo(0.375));
  it("rounds Kling up to 5 s increments", () => expect(lipsyncCost(kling, 3)).toBeCloseTo(0.07));
  it("chunks Kling at 10 s and rounds each chunk", () => {
    // 75 s -> 7 chunks of 10 s + 1 chunk of 5 s = 75 billed seconds
    expect(lipsyncCost(kling, 75)).toBeCloseTo(75 * 0.014);
    // 12 s -> 10 s + 2 s (billed 5 s) = 15 billed seconds
    expect(lipsyncCost(kling, 12)).toBeCloseTo(15 * 0.014);
  });
  it("rejects non-positive durations", () => expect(() => lipsyncCost(perSecond, 0)).toThrow());
});

describe("margins", () => {
  const inputs = loadConfig();

  it("charges Stripe percentage plus fixed fee", () => {
    expect(stripeFee(inputs.rates, 10)).toBeCloseTo(10 * inputs.rates.stripe.pct + inputs.rates.stripe.fixedUsd);
  });

  it("computes margin after Stripe fee", () => {
    const line = margin(inputs.rates, 10, 2);
    expect(line.costUsd).toBeCloseTo(2 + stripeFee(inputs.rates, 10));
    expect(line.marginPct).toBeCloseTo(line.marginUsd / 10);
  });

  it("personalized-only lip-sync is cheaper than full lip-sync", () => {
    const full = customVideoCost(inputs, "sync-lipsync-2", "fullLipsync");
    const partial = customVideoCost(inputs, "sync-lipsync-2", "personalizedOnly");
    expect(partial).toBeLessThan(full);
  });

  it("deducts the 20% business revenue share on referred custom upgrades", () => {
    const direct = margin(inputs.rates, 12.99, customVideoCost(inputs, "sync-lipsync-2", "fullLipsync"));
    const referred = businessReferredCustomMargin(inputs, "sync-lipsync-2", "fullLipsync");
    expect(direct.marginUsd - referred.marginUsd).toBeCloseTo(12.99 * inputs.pricing.businessRevenueShare);
  });
});
