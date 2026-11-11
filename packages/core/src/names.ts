import { BLOCKED_NAME_WORDS } from "./nameBlocklist";

export const NAME_MAX_LENGTH = 20;

export type NameRejection = "empty" | "tooLong" | "invalidCharacters" | "blocked";

export type NameValidation =
  | { ok: true; displayName: string; nameKey: string }
  | { ok: false; reason: NameRejection };

/** Letters (any script, with accents), with single spaces, hyphens or apostrophes between letter runs. */
const NAME_PATTERN = /^\p{L}[\p{L}\p{M}]*(?:[ '’-]\p{L}[\p{L}\p{M}]*)*$/u;

/** Library/cache key for a name: case-insensitive, Unicode-normalized, typographic apostrophes folded. */
export function toNameKey(displayName: string): string {
  return displayName.normalize("NFC").replace(/’/g, "'").toLocaleLowerCase("en");
}

/** "emma" / "EMMA" -> "Emma"; mixed case typed by the parent ("McKenzie") is kept as is. */
function normalizeCase(name: string): string {
  const isUniform = name === name.toLocaleLowerCase() || name === name.toLocaleUpperCase();
  if (!isUniform) return name;
  return name
    .toLocaleLowerCase()
    .replace(/(^|[ '’-])(\p{L})/gu, (_match, sep: string, letter: string) => sep + letter.toLocaleUpperCase());
}

/**
 * Validates a child's first name typed by a parent. Only a first name is accepted (no surname rules needed:
 * we never ask for one). Rejects profanity and obvious non-names before anything is stored or rendered.
 */
export function validateFirstName(raw: string): NameValidation {
  const collapsed = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return { ok: false, reason: "empty" };
  if ([...collapsed].length > NAME_MAX_LENGTH) return { ok: false, reason: "tooLong" };
  if (!NAME_PATTERN.test(collapsed)) return { ok: false, reason: "invalidCharacters" };

  const nameKey = toNameKey(collapsed);
  const words = nameKey.split(/[ '-]/);
  if (words.some((w) => BLOCKED_NAME_WORDS.has(w)) || BLOCKED_NAME_WORDS.has(nameKey.replace(/[ '-]/g, ""))) {
    return { ok: false, reason: "blocked" };
  }
  return { ok: true, displayName: normalizeCase(collapsed), nameKey };
}
