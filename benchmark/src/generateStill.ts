/**
 * Generates 16:9 stills of our Santa from reference images (fal Nano Banana Pro edit).
 *
 *   npm run bench:still                # dry run: shows prompt, references and cost
 *   npm run bench:still -- --confirm   # generates (needs FAL_KEY)
 *   npm run bench:still -- --image=<png> --prompt-file=<txt> --count=1 --name=<out-name> [--confirm]
 *                                      # edit one existing still (e.g. open the eyes) instead
 */
import { mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { REPO_ROOT } from "./config.js";
import { createClient, describeFalError, uploadFile } from "./falProvider.js";

const ENDPOINT = "fal-ai/nano-banana-pro/edit"; // schema verified on fal API page 2026-11-10
const USD_PER_IMAGE = 0.15; // fal.ai/pricing, 2026-11-10
const NUM_IMAGES = 4;

const REFERENCE_FRAMES = [
  "benchmark/assets/reference/ref_0.5.jpg",
  "benchmark/assets/reference/ref_2.5.jpg",
];
const PROMPT_FILE = "benchmark/prompts/master-still.txt";
const OUT_DIR = join(REPO_ROOT, "benchmark", "out", "stills");

interface NanoBananaOutput {
  images?: Array<{ url?: string }>;
}

function flag(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function main(): Promise<void> {
  const confirmed = process.argv.includes("--confirm");
  const references = flag("image") ? [flag("image")!] : REFERENCE_FRAMES;
  const prompt = readFileSync(join(REPO_ROOT, flag("prompt-file") ?? PROMPT_FILE), "utf8").trim();
  const count = Number(flag("count") ?? NUM_IMAGES);
  if (!Number.isInteger(count) || count < 1 || count > 4) throw new Error("--count must be 1-4");
  const outName = (flag("name") ?? "master-still").replace(/[^a-z0-9-]/gi, "");
  const estimateUsd = count * USD_PER_IMAGE;

  console.log(`Endpoint: ${ENDPOINT}\nReferences: ${references.join(", ")}\nImages: ${count} @ 2K, 16:9`);
  console.log(`Estimated spend: $${estimateUsd.toFixed(2)}\n\nPrompt:\n${prompt}\n`);
  if (!confirmed) {
    console.log("Dry run only. Re-run with --confirm to generate.");
    return;
  }

  const client = createClient();
  const imageUrls = await Promise.all(references.map((path) => uploadFile(client, join(REPO_ROOT, path))));
  const startedAt = Date.now();
  const result = await client.subscribe(ENDPOINT, {
    input: { prompt, image_urls: imageUrls, num_images: count, aspect_ratio: "16:9", resolution: "2K", output_format: "png" },
  });

  const urls = ((result.data as NanoBananaOutput).images ?? []).map((image) => image.url).filter((url): url is string => !!url);
  if (urls.length === 0) throw new Error(`No images returned: ${JSON.stringify(result.data).slice(0, 300)}`);

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const [index, url] of urls.entries()) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed (${response.status}) for candidate ${index + 1}`);
    const path = join(OUT_DIR, `${outName}_${stamp}_${index + 1}.png`);
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
    console.log(`Saved ${path}`);
  }
  console.log(`Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s, ~$${(urls.length * USD_PER_IMAGE).toFixed(2)}`);
}

main().catch((error) => {
  console.error(describeFalError(error));
  process.exitCode = 1;
});
