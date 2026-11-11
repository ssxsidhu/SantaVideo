import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";
import { finalVideoCacheKey, nameClipCacheKey } from "./cacheKeys";
import { en } from "./i18n/en";
import { fr } from "./i18n/fr";
import { format, negotiateLocale } from "./i18n";
import { validateFirstName } from "./names";
import { formatPrice, getProductPrice } from "./pricing";
import { isUrlToken, newUrlToken } from "./tokens";

describe("validateFirstName", () => {
  it.each([
    ["emma", "Emma", "emma"],
    ["  EMMA  ", "Emma", "emma"],
    ["McKenzie", "McKenzie", "mckenzie"],
    ["mary-jane", "Mary-Jane", "mary-jane"],
    ["d'andre", "D'Andre", "d'andre"],
    ["D’Andre", "D’Andre", "d'andre"],
    ["anne   marie", "Anne Marie", "anne marie"],
    ["léa", "Léa", "léa"],
    ["Zoë", "Zoë", "zoë"],
    ["Siobhán", "Siobhán", "siobhán"],
  ])("accepts %j as %j (key %j)", (raw, displayName, nameKey) => {
    expect(validateFirstName(raw)).toEqual({ ok: true, displayName, nameKey });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["Emma2", "invalidCharacters"],
    ["<script>", "invalidCharacters"],
    ["Emma Smith Jones!", "invalidCharacters"],
    ["-Emma", "invalidCharacters"],
    ["Em--ma", "invalidCharacters"],
    ["https://x.y", "invalidCharacters"],
    ["Maximilianoooooooooooo", "tooLong"],
    ["shit", "blocked"],
    ["Poop Head", "blocked"],
    ["merde", "blocked"],
    ["test", "blocked"],
  ])("rejects %j (%s)", (raw, reason) => {
    expect(validateFirstName(raw)).toEqual({ ok: false, reason });
  });

  it("does not block real names that contain a blocked word inside them", () => {
    expect(validateFirstName("Cassandra").ok).toBe(true); // contains "ass"
    expect(validateFirstName("Dickens").ok).toBe(true);
    expect(validateFirstName("Connor").ok).toBe(true); // contains "con"
  });
});

describe("tokens", () => {
  it("are 43-char base64url and unique", () => {
    const a = newUrlToken();
    expect(isUrlToken(a)).toBe(true);
    expect(a).not.toBe(newUrlToken());
    expect(isUrlToken("emma")).toBe(false);
  });
});

describe("encryptSecret", () => {
  const key = randomBytes(32);
  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptSecret("parent@example.com", key);
    expect(a).not.toContain("parent");
    expect(a).not.toBe(encryptSecret("parent@example.com", key));
    expect(decryptSecret(a, key)).toBe("parent@example.com");
  });
  it("rejects tampered ciphertext and wrong keys", () => {
    const a = encryptSecret("parent@example.com", key);
    const parts = a.split(".");
    parts[3] = Buffer.from("x" + Buffer.from(parts[3]!, "base64url").toString("latin1"), "latin1").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() => decryptSecret(a, randomBytes(32))).toThrow();
  });
});

describe("cache keys", () => {
  const spec = { nameKey: "emma", language: "en" as const, voiceId: "v1", masterVersion: "m1", lipsyncModel: "lipsync-2-pro" };
  it("are stable and never contain the name", () => {
    expect(nameClipCacheKey(spec)).toBe(nameClipCacheKey({ ...spec }));
    expect(nameClipCacheKey(spec)).toMatch(/^[0-9a-f]{32}$/);
  });
  it("change when anything that affects the clip changes", () => {
    const base = nameClipCacheKey(spec);
    for (const change of [{ nameKey: "emmy" }, { voiceId: "v2" }, { masterVersion: "m2" }, { lipsyncModel: "x" }, { pronunciation: "Emmah" }]) {
      expect(nameClipCacheKey({ ...spec, ...change })).not.toBe(base);
    }
  });
  it("final key depends on the end card and its style", () => {
    const card = { displayName: "Emma", style: "s1" };
    expect(finalVideoCacheKey("c", card)).not.toBe(finalVideoCacheKey("c", { ...card, campaignId: "x" }));
    expect(finalVideoCacheKey("c", card)).not.toBe(finalVideoCacheKey("c", { ...card, style: "s2" }));
  });
});

describe("pricing", () => {
  it("reads the instant price from config/pricing.json in cents", () => {
    expect(getProductPrice("instant")).toEqual({ product: "instant", currency: "usd", amountMinor: 599 });
    expect(formatPrice(getProductPrice("instant"), "en-US")).toBe("$5.99");
  });
});

describe("i18n", () => {
  const keysOf = (o: unknown, prefix = ""): string[] =>
    o && typeof o === "object" && !Array.isArray(o)
      ? Object.entries(o).flatMap(([k, v]) => keysOf(v, `${prefix}${k}.`))
      : [prefix];
  it("French has every English key and the same placeholders", () => {
    expect(keysOf(fr)).toEqual(keysOf(en));
    const placeholders = (o: unknown): string[] => JSON.stringify(o).match(/\{\w+\}/g)?.sort() ?? [];
    expect(placeholders(fr)).toEqual(placeholders(en));
  });
  it("formats placeholders and negotiates locales", () => {
    expect(format("Hello there, {name}!", { name: "Emma" })).toBe("Hello there, Emma!");
    expect(negotiateLocale("fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(negotiateLocale("de-DE,en;q=0.5")).toBe("en");
    expect(negotiateLocale(undefined)).toBe("en");
  });
});
