import { readFile, writeFile } from "node:fs/promises";
import { createFalClient, type FalClient } from "@fal-ai/client";

// Plain string on purpose: the fal client's bundled model types predate lipsync-2-pro (verified working 2026-11-10).
export const LIPSYNC_ENDPOINT: string = "fal-ai/sync-lipsync/v2";
export const LIPSYNC_MODEL = "lipsync-2-pro";
/** fal list price for lipsync-2-pro (verified 2026-11-10). */
export const LIPSYNC_USD_PER_SECOND = 0.0835;

let client: FalClient | undefined;

function fal(): FalClient {
  if (!client) {
    const key = process.env.FAL_KEY;
    if (!key) throw new Error("FAL_KEY is not set");
    client = createFalClient({ credentials: key });
  }
  return client;
}

async function upload(path: string, name: string, type: string): Promise<string> {
  // Generic file names only: never a child's name, email or order id in vendor uploads.
  return fal().storage.upload(new File([await readFile(path)], name, { type }));
}

/** Redraws the mouth of the slot clip to the fitted greeting. Writes the result to `outPath`. */
export async function lipsyncSlot(slotVideo: string, greetingWav: string, outPath: string): Promise<void> {
  const [videoUrl, audioUrl] = await Promise.all([
    upload(slotVideo, "slot.mp4", "video/mp4"),
    upload(greetingWav, "greeting.wav", "audio/wav"),
  ]);
  const result = await fal().subscribe(LIPSYNC_ENDPOINT, {
    input: { model: LIPSYNC_MODEL, sync_mode: "cut_off", video_url: videoUrl, audio_url: audioUrl },
  });
  const url = (result.data as { video?: { url?: unknown } } | null)?.video?.url;
  if (typeof url !== "string") throw new Error("Lip-sync returned no video");
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Lip-sync download failed (HTTP ${response.status})`);
  await writeFile(outPath, Buffer.from(await response.arrayBuffer()));
}
