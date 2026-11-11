/**
 * Renders the silent slow-open shot: starts on the letter-reading frame, ends exactly on the master still
 * (fal Kling O3 image-to-video with end frame). The last frame hands off to OmniHuman part A.
 *
 *   npm run bench:opening              # dry run
 *   npm run bench:opening -- --confirm # generate (~$0.59)
 */
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { REPO_ROOT } from "./config.js";
import { createClient, describeFalError, uploadFile } from "./falProvider.js";

const ENDPOINT = "fal-ai/kling-video/o3/standard/image-to-video"; // fields verified 2026-11-10
const USD_PER_SECOND = 0.084; // audio off
const DURATION_SECONDS = 7;
const DURATION_PARAM = "7" as const; // Kling O3 takes a string enum "3".."15"
const START = "benchmark/assets/master/opening-letter_1920x1080.png";
const END = "benchmark/assets/master/santa-master-still_1920x1080.png";
const PROMPT =
  "Slow, smooth, steady camera push-in toward Santa Claus in his cozy log cabin. He finishes reading a child's " +
  "crayon letter with a tender smile, gently lowers the letter out of frame, then lifts his head and looks warmly " +
  "straight into the camera with a gentle closed-mouth smile. The fire flickers and the tree lights twinkle softly. " +
  "He does not speak. Photorealistic, cinematic warm firelight, no cuts.";

async function main(): Promise<void> {
  console.log(`${ENDPOINT}: ${DURATION_SECONDS}s x $${USD_PER_SECOND}/s = $${(DURATION_SECONDS * USD_PER_SECOND).toFixed(2)}`);
  if (!process.argv.includes("--confirm")) {
    console.log("Dry run only. Re-run with --confirm to generate.");
    return;
  }
  const client = createClient();
  const [startUrl, endUrl] = await Promise.all([
    uploadFile(client, join(REPO_ROOT, START)),
    uploadFile(client, join(REPO_ROOT, END)),
  ]);
  const startedAt = Date.now();
  const result = await client.subscribe(ENDPOINT, {
    input: { image_url: startUrl, end_image_url: endUrl, prompt: PROMPT, duration: DURATION_PARAM, generate_audio: false },
  });
  const url = (result.data as { video?: { url?: string } }).video?.url;
  if (!url) throw new Error(`No video in response: ${JSON.stringify(result.data).slice(0, 300)}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const outDir = join(REPO_ROOT, "benchmark", "out", "masters");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "master-en-opening__kling-o3.mp4");
  await writeFile(outPath, Buffer.from(await response.arrayBuffer()));
  console.log(`OK in ${((Date.now() - startedAt) / 1000).toFixed(0)}s -> ${outPath}`);
}

main().catch((error) => {
  console.error(describeFalError(error));
  process.exitCode = 1;
});
