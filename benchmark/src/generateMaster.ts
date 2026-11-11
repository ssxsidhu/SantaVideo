/**
 * Animates the master still into a talking master video from master audio (fal talking-avatar models).
 *
 *   npm run bench:master -- <audio.mp3> [kling-pro|kling-standard|omnihuman] ...    # dry run
 *   npm run bench:master -- <audio.mp3> kling-pro omnihuman --confirm              # generate
 */
import { mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { REPO_ROOT } from "./config.js";
import { createClient, describeFalError, uploadFile } from "./falProvider.js";
import { probeDurationSeconds } from "./media.js";

interface AvatarModel {
  endpoint: string;
  usdPerSecond: number;
  maxSeconds?: number;
  extraInput: Record<string, unknown>;
}

// Endpoints, inputs and prices verified on fal model pages / llms.txt, 2026-11-10.
const AVATAR_MODELS: Record<string, AvatarModel> = {
  "kling-pro": { endpoint: "fal-ai/kling-video/ai-avatar/v2/pro", usdPerSecond: 0.115, extraInput: {} },
  "kling-standard": { endpoint: "fal-ai/kling-video/ai-avatar/v2/standard", usdPerSecond: 0.0562, extraInput: {} },
  omnihuman: {
    endpoint: "fal-ai/bytedance/omnihuman/v1.5",
    usdPerSecond: 0.16,
    maxSeconds: 30, // "under 30s long for 1080p generation"
    extraInput: { resolution: "1080p" },
  },
  // fal schema (checked 2026-11-10): audio under 60 s at 720p, "faster and higher in quality". Upscaled to 1080p in assembly.
  "omnihuman-720p": {
    endpoint: "fal-ai/bytedance/omnihuman/v1.5",
    usdPerSecond: 0.16,
    maxSeconds: 60,
    extraInput: { resolution: "720p" },
  },
};

const STILL = "benchmark/assets/master/santa-master-still_1920x1080.png";
const PROMPT =
  "Santa Claus on a warm, friendly video call. He speaks naturally and gently to the camera with small, " +
  "natural head movements and kind eye contact. Camera is static. Background stays still except the fire flickering.";
const OUT_DIR = join(REPO_ROOT, "benchmark", "out", "masters");

async function main(): Promise<void> {
  const flag = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const confirmed = process.argv.includes("--confirm");
  const stillPath = resolve(REPO_ROOT, flag("image") ?? STILL);
  const outName = flag("name") ?? "master-en-test";
  const promptFile = flag("prompt-file");
  const prompt = promptFile ? readFileSync(resolve(REPO_ROOT, promptFile), "utf8").trim() : PROMPT;
  const [audioArg, ...modelNames] = args;
  if (!audioArg || modelNames.length === 0) throw new Error("Usage: bench:master -- <audio> <model...> [--confirm]");

  const audioPath = resolve(REPO_ROOT, audioArg);
  const seconds = await probeDurationSeconds(audioPath);
  const budgetUsd = Number(process.env.BENCH_BUDGET_USD ?? 20);

  let totalUsd = 0;
  for (const name of modelNames) {
    const model = AVATAR_MODELS[name];
    if (!model) throw new Error(`Unknown model "${name}". Options: ${Object.keys(AVATAR_MODELS).join(", ")}`);
    if (model.maxSeconds && seconds >= model.maxSeconds) {
      throw new Error(`${name} needs audio under ${model.maxSeconds}s, got ${seconds.toFixed(1)}s`);
    }
    totalUsd += seconds * model.usdPerSecond;
    console.log(`${name}: ${seconds.toFixed(1)}s x $${model.usdPerSecond}/s = $${(seconds * model.usdPerSecond).toFixed(2)}`);
  }
  console.log(`Estimated spend: $${totalUsd.toFixed(2)} (budget $${budgetUsd})`);
  if (totalUsd > budgetUsd) throw new Error("Estimate exceeds BENCH_BUDGET_USD - get owner approval first.");
  if (!confirmed) {
    console.log("Dry run only. Re-run with --confirm to generate.");
    return;
  }

  const client = createClient();
  const [imageUrl, audioUrl] = await Promise.all([
    uploadFile(client, stillPath),
    uploadFile(client, audioPath),
  ]);
  mkdirSync(OUT_DIR, { recursive: true });

  await Promise.all(
    modelNames.map(async (name) => {
      const model = AVATAR_MODELS[name]!;
      const startedAt = Date.now();
      try {
        const result = await client.subscribe(model.endpoint, {
          input: { image_url: imageUrl, audio_url: audioUrl, prompt, ...model.extraInput },
        });
        const url = (result.data as { video?: { url?: string } }).video?.url;
        if (!url) throw new Error(`No video in response: ${JSON.stringify(result.data).slice(0, 300)}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Download failed (${response.status})`);
        const outPath = join(OUT_DIR, `${outName}__${name}.mp4`);
        await writeFile(outPath, Buffer.from(await response.arrayBuffer()));
        console.log(`OK   ${name} in ${((Date.now() - startedAt) / 1000).toFixed(0)}s -> ${outPath}`);
      } catch (error) {
        console.error(`FAIL ${name}: ${describeFalError(error)}`);
      }
    }),
  );
}

main().catch((error) => {
  console.error(describeFalError(error));
  process.exitCode = 1;
});
