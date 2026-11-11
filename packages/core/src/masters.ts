import { join } from "node:path";
import mastersJson from "../../../config/masters.json";
import type { VideoLanguage } from "./cacheKeys";

export interface MasterConfig {
  version: string;
  /** Absolute paths, resolved against the repo root. */
  take: string;
  voiceTrack: string;
  music: string;
  voiceId: string;
  tts: { model: string; stability: number; similarity_boost: number; style: number; speed: number };
  nameSlot: { start: number; end: number };
  /** Where the spoken greeting starts inside the slot (the slot boundaries sit mid-pause). */
  greetingOffset: number;
  /** Feathered oval (1920x1080 pixels) of lip-sync pixels pasted back over the master. */
  mouthMask: { cx: number; cy: number; rx: number; ry: number };
  /** Take time whose frame becomes the end-card / preview plate. */
  endCardFrom: number;
  /** Derived files built once by `npm run master:prepare` (upscaled body, slot clip, plate). */
  derivedDir: string;
}

type RawMaster = Omit<MasterConfig, "derivedDir">;

export function getMaster(language: VideoLanguage, repoRoot: string): MasterConfig {
  const raw = (mastersJson as unknown as Record<string, RawMaster | undefined>)[language];
  if (!raw) throw new Error(`No master video configured for language "${language}"`);
  return {
    ...raw,
    take: join(repoRoot, raw.take),
    voiceTrack: join(repoRoot, raw.voiceTrack),
    music: join(repoRoot, raw.music),
    derivedDir: join(repoRoot, ".data", "masters", raw.version),
  };
}

/** Languages with a master video today (FR video is deferred by the owner). */
export function availableVideoLanguages(): VideoLanguage[] {
  return (["en", "fr"] as const).filter((l) => l in (mastersJson as Record<string, unknown>));
}

export const derivedFiles = {
  /** Talking take upscaled to 1920x1080, 25 fps, no audio, trimmed to the voice track. */
  body: (m: MasterConfig) => join(m.derivedDir, "body.mp4"),
  /** The name-slot frames of the body (what the lip-sync provider redraws). */
  slot: (m: MasterConfig) => join(m.derivedDir, "slot.mp4"),
  /** Still used behind the end card and the preview image. */
  plate: (m: MasterConfig) => join(m.derivedDir, "plate.png"),
  manifest: (m: MasterConfig) => join(m.derivedDir, "prepared.json"),
};
