import { createHash } from "node:crypto";

export type VideoLanguage = "en" | "fr";

/** Everything that changes what a name clip looks or sounds like. Any change = a new clip. */
export interface NameClipSpec {
  nameKey: string;
  language: VideoLanguage;
  voiceId: string;
  masterVersion: string;
  lipsyncModel: string;
  /** Respelling sent to TTS instead of the name, when the pronunciation table has one. */
  pronunciation?: string;
}

function hash(parts: Record<string, string>): string {
  const canonical = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

/** Library cache key. Hashed so storage paths and vendor file names never contain the name itself. */
export function nameClipCacheKey(spec: NameClipSpec): string {
  return hash({
    kind: "name-clip",
    name: spec.nameKey,
    lang: spec.language,
    voice: spec.voiceId,
    master: spec.masterVersion,
    model: spec.lipsyncModel,
    pron: spec.pronunciation ?? "",
  });
}

/** Final video cache key: same clip + same end card = same file (repeat names are free). */
export function finalVideoCacheKey(clipKey: string, endCard: { displayName: string; campaignId?: string; style: string }): string {
  return hash({ kind: "final", clip: clipKey, card: endCard.displayName, campaign: endCard.campaignId ?? "", style: endCard.style });
}
