/**
 * One-off per master version: builds the derived files every order reuses.
 *
 *   npm run master:prepare            (English master from config/masters.json)
 *
 * body.mp4  talking take upscaled to 1920x1080 @25 fps, no audio, trimmed to the voice track
 * slot.mp4  just the name-slot frames of body.mp4 (what Sync redraws), frame-aligned
 * plate.png still behind the end card and the preview image
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { derivedFiles, findRepoRoot, getMaster, probeDurationSeconds, runTool, type MasterConfig } from "@santa/core";
import { FPS, UPSCALE_FILTER, slotFrames, type PreparedMaster } from "./master";

export async function prepareMaster(master: MasterConfig): Promise<PreparedMaster> {
  for (const path of [master.take, master.voiceTrack, master.music]) {
    if (!existsSync(path)) throw new Error(`Missing master source file: ${path}`);
  }
  await mkdir(master.derivedDir, { recursive: true });
  const voiceSeconds = await probeDurationSeconds(master.voiceTrack);
  const slot = slotFrames(master.nameSlot);

  const body = derivedFiles.body(master);
  await runTool("ffmpeg", [
    "-v", "error", "-y", "-i", master.take,
    "-t", voiceSeconds.toFixed(3), "-an",
    "-vf", UPSCALE_FILTER,
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-r", String(FPS), "-g", String(FPS),
    body,
  ]);
  await runTool("ffmpeg", [
    "-v", "error", "-y", "-i", body,
    "-vf", `trim=start_frame=${slot.startFrame}:end_frame=${slot.endFrame},setpts=PTS-STARTPTS`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-r", String(FPS),
    derivedFiles.slot(master),
  ]);
  await runTool("ffmpeg", [
    "-v", "error", "-y", "-ss", String(master.endCardFrom), "-i", body, "-frames:v", "1", derivedFiles.plate(master),
  ]);

  const prepared: PreparedMaster = { version: master.version, voiceSeconds, slot };
  await writeFile(derivedFiles.manifest(master), JSON.stringify(prepared, null, 2));
  return prepared;
}

if (process.argv[1]?.endsWith("prepareMaster.ts")) {
  const master = getMaster("en", findRepoRoot());
  prepareMaster(master)
    .then((p) => console.log(`Prepared ${p.version}: voice ${p.voiceSeconds.toFixed(2)} s, slot frames ${p.slot.startFrame}-${p.slot.endFrame} (${p.slot.seconds.toFixed(2)} s) -> ${master.derivedDir}`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
