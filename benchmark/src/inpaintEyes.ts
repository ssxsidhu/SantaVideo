/**
 * Redraws only a masked region (Santa's eyes) of a clip with fal Wan VACE 14B inpainting.
 *
 *   npm run bench:inpaint -- <clip.mp4> <mask.mp4> <ref.png> <out.mp4> [--confirm]
 *
 * White in the mask = regenerate; everything else is kept (and is composited back from the original afterwards).
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.js";
import { createClient, describeFalError, uploadFile } from "./falProvider.js";
import { probeDurationSeconds, probeVideo } from "./media.js";

const ENDPOINT = "fal-ai/wan-vace-14b/inpainting"; // schema checked on fal llms.txt 2026-11-11
const USD_PER_VIDEO_SECOND_720P = 0.08; // "video seconds are calculated at 16 frames per second"
const PROMPT =
  "An elderly Santa Claus with kind, open, clear blue-grey eyes, irises and pupils clearly visible behind thin gold " +
  "wire-rim glasses, natural eyelids and gentle crow's feet, soft natural blinking, warm firelight. Photorealistic, " +
  "consistent with the rest of his face.";
const NEGATIVE =
  "closed eyes, squinting, half-closed eyelids, distorted glasses, extra eyes, deformed face, blurry, flicker, " +
  "low quality, cartoon";

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (args.length !== 4) throw new Error("Usage: bench:inpaint -- <clip.mp4> <mask.mp4> <ref.png> <out.mp4> [--confirm]");
  const [clip, mask, ref, out] = args.map((a) => resolve(REPO_ROOT, a)) as [string, string, string, string];

  const [info, seconds] = await Promise.all([probeVideo(clip), probeDurationSeconds(clip)]);
  const frames = Math.round(seconds * info.fps);
  if (frames > 241) throw new Error(`Clip has ${frames} frames; VACE accepts at most 241`);
  const estimate = (frames / 16) * USD_PER_VIDEO_SECOND_720P;
  console.log(`${ENDPOINT}: ${frames} frames @ ${info.fps} fps -> ~$${estimate.toFixed(2)}`);
  if (!process.argv.includes("--confirm")) {
    console.log("Dry run only. Re-run with --confirm to generate.");
    return;
  }

  const client = createClient();
  const [videoUrl, maskUrl, refUrl] = await Promise.all([uploadFile(client, clip), uploadFile(client, mask), uploadFile(client, ref)]);
  const startedAt = Date.now();
  const result = await client.subscribe(ENDPOINT, {
    input: {
      prompt: PROMPT,
      negative_prompt: NEGATIVE,
      video_url: videoUrl,
      mask_video_url: maskUrl,
      ref_image_urls: [refUrl],
      match_input_num_frames: true,
      match_input_frames_per_second: true,
      resolution: "720p",
      aspect_ratio: "16:9",
      num_inference_steps: 30,
      acceleration: "none",
      video_quality: "maximum",
    },
  });
  const url = (result.data as { video?: { url?: string } }).video?.url;
  if (!url) throw new Error(`No video in response: ${JSON.stringify(result.data).slice(0, 300)}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  await writeFile(out, Buffer.from(await response.arrayBuffer()));
  console.log(`OK in ${((Date.now() - startedAt) / 1000).toFixed(0)}s -> ${out}`);
}

main().catch((error) => {
  console.error(describeFalError(error));
  process.exitCode = 1;
});
