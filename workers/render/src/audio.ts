import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { probeDurationSeconds, runTool } from "@santa/core";
import type { SlotFit } from "./slotFit";

const TRIM_SILENCE =
  "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02," +
  "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse";

/** Writes the TTS MP3, trims leading/trailing silence and returns the trimmed WAV + speech length. */
export async function trimGreeting(mp3: Buffer, workDir: string, tag: string): Promise<{ path: string; seconds: number }> {
  const raw = join(workDir, `tts-${tag}.mp3`);
  const trimmed = join(workDir, `tts-${tag}-trim.wav`);
  await writeFile(raw, mp3);
  await runTool("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", TRIM_SILENCE, "-ar", "48000", "-ac", "1", trimmed]);
  return { path: trimmed, seconds: await probeDurationSeconds(trimmed) };
}

/** Places the trimmed greeting inside a slot-length WAV per the fit decision. */
export async function writeFittedGreeting(trimmed: string, fit: Exclude<SlotFit, { action: "retryFaster" }>, slotSeconds: number, outPath: string): Promise<void> {
  const tempo = fit.tempo === 1 ? "" : `atempo=${fit.tempo.toFixed(4)},`;
  const delayMs = Math.round(fit.offset * 1000);
  await runTool("ffmpeg", [
    "-v", "error", "-y", "-i", trimmed,
    "-af", `${tempo}adelay=${delayMs}:all=1,apad,atrim=0:${slotSeconds.toFixed(3)}`,
    "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le",
    outPath,
  ]);
}
