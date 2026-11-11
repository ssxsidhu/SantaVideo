import { readFile } from "node:fs/promises";
import { derivedFiles, type MasterConfig } from "@santa/core";

export const FPS = 25;
export const UPSCALE_FILTER =
  `scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,` +
  `unsharp=5:5:0.5:5:5:0.0,fps=${FPS},setsar=1,format=yuv420p`;

export interface SlotFrames {
  startFrame: number;
  endFrame: number;
  /** Frame-aligned times in the take (and the final video, which starts with the take). */
  start: number;
  seconds: number;
}

export interface PreparedMaster {
  version: string;
  voiceSeconds: number;
  slot: SlotFrames;
}

/** Snaps the configured slot to whole frames so the lip-synced clip lines up with the master exactly. */
export function slotFrames(slot: { start: number; end: number }): SlotFrames {
  const startFrame = Math.round(slot.start * FPS);
  const endFrame = Math.round(slot.end * FPS);
  if (endFrame <= startFrame) throw new Error("Name slot is empty");
  return { startFrame, endFrame, start: startFrame / FPS, seconds: (endFrame - startFrame) / FPS };
}

export async function loadPrepared(master: MasterConfig): Promise<PreparedMaster> {
  let prepared: PreparedMaster;
  try {
    prepared = JSON.parse(await readFile(derivedFiles.manifest(master), "utf8")) as PreparedMaster;
  } catch {
    throw new Error(`Master ${master.version} is not prepared: run \`npm run master:prepare\``);
  }
  if (prepared.version !== master.version) throw new Error(`Prepared files are for ${prepared.version}, config says ${master.version}`);
  return prepared;
}
