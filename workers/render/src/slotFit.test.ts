import { describe, expect, it } from "vitest";
import { MAX_TEMPO, fitGreetingToSlot, nextTtsSpeed } from "./slotFit";

const SLOT = 2.28; // launch master: frames 128-185
const OFFSET = 0.35;

describe("fitGreetingToSlot", () => {
  it("places a short greeting at the master's own offset", () => {
    expect(fitGreetingToSlot(1.2, SLOT, OFFSET)).toEqual({ action: "place", offset: OFFSET, tempo: 1 });
  });

  it("starts a slightly long greeting earlier instead of speeding it up", () => {
    const fit = fitGreetingToSlot(1.9, SLOT, OFFSET);
    expect(fit.action).toBe("place");
    if (fit.action === "place") {
      expect(fit.offset).toBeGreaterThanOrEqual(OFFSET / 2);
      expect(fit.offset + 1.9).toBeLessThanOrEqual(SLOT);
    }
  });

  it("speeds up a little when needed, never past the limit", () => {
    const fit = fitGreetingToSlot(2.05, SLOT, OFFSET);
    expect(fit.action).toBe("speedUp");
    if (fit.action === "speedUp") {
      expect(fit.tempo).toBeGreaterThan(1);
      expect(fit.tempo).toBeLessThanOrEqual(MAX_TEMPO);
      expect(fit.offset + 2.05 / fit.tempo).toBeLessThanOrEqual(SLOT);
    }
  });

  it("asks for a faster TTS take when the greeting is far too long", () => {
    expect(fitGreetingToSlot(2.6, SLOT, OFFSET)).toEqual({ action: "retryFaster" });
  });

  it("rejects nonsense durations", () => {
    expect(() => fitGreetingToSlot(0, SLOT, OFFSET)).toThrow();
    expect(() => fitGreetingToSlot(1, -1, OFFSET)).toThrow();
  });
});

describe("nextTtsSpeed", () => {
  it("steps up from the master speed and stops at the ceiling", () => {
    expect(nextTtsSpeed(0.9)).toBe(0.96);
    expect(nextTtsSpeed(0.96)).toBe(1.02);
    expect(nextTtsSpeed(1.02)).toBe(1.08);
    expect(nextTtsSpeed(1.08)).toBeUndefined();
  });
});
