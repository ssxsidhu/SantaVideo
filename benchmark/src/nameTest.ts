/**
 * Name-switch test: lip-syncs the master's name-slot clip to each fitted greeting, with each provider.
 *
 *   npm run bench:names -- <dir> <name...> [--providers=sync-lipsync-2,sync-lipsync-2-pro] [--confirm]
 *
 * Expects <dir>/slot.mp4 (video-only slot clip) and <dir>/<name>/fitted.wav (slot-length greeting).
 * Writes <dir>/<name>/<provider>.mp4 and prints timing. Names here are public test names, never customer data.
 */
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { REPO_ROOT, type LipsyncProviderId } from "./config.js";
import { createClient, describeFalError, loadProviderEndpoints, runLipsync, uploadFile } from "./falProvider.js";
import { probeDurationSeconds } from "./media.js";

/** fal list prices (llms.txt, 2026-11-10): lipsync-2 $3/min; pro ~1.67x. */
const USD_PER_SECOND: Partial<Record<LipsyncProviderId, number>> = {
  "sync-lipsync-2": 0.05,
  "sync-lipsync-2-pro": 0.0835,
};

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const providerFlag = process.argv.find((a) => a.startsWith("--providers="))?.slice("--providers=".length);
  const providers = (providerFlag ?? "sync-lipsync-2,sync-lipsync-2-pro").split(",") as LipsyncProviderId[];
  const [dirArg, ...names] = args;
  if (!dirArg || names.length === 0) throw new Error("Usage: bench:names -- <dir> <name...> [--providers=...] [--confirm]");

  const dir = resolve(REPO_ROOT, dirArg);
  const slotPath = join(dir, "slot.mp4");
  const greetings = names.map((n) => join(dir, n, "fitted.wav"));
  for (const path of [slotPath, ...greetings]) if (!existsSync(path)) throw new Error(`Missing input: ${path}`);

  const endpoints = loadProviderEndpoints();
  const slotSeconds = await probeDurationSeconds(slotPath);
  let estimate = 0;
  for (const p of providers) {
    const rate = USD_PER_SECOND[p];
    if (!endpoints[p] || rate === undefined) throw new Error(`Unknown provider ${p}`);
    estimate += rate * slotSeconds * names.length;
  }
  const budget = Number(process.env.BENCH_BUDGET_USD ?? 3);
  console.log(`${names.length} names x ${providers.length} providers x ${slotSeconds}s = ~$${estimate.toFixed(2)} (budget $${budget})`);
  if (estimate > budget) throw new Error("Estimate exceeds BENCH_BUDGET_USD - get owner approval first.");
  if (!process.argv.includes("--confirm")) {
    console.log("Dry run only. Re-run with --confirm to generate.");
    return;
  }

  const client = createClient();
  const videoUrl = await uploadFile(client, slotPath);
  await Promise.all(
    names.map(async (name, i) => {
      const audioUrl = await uploadFile(client, greetings[i]!);
      for (const provider of providers) {
        try {
          const result = await runLipsync(client, provider, endpoints[provider]!, videoUrl, audioUrl);
          const response = await fetch(result.outputUrl);
          if (!response.ok) throw new Error(`Download failed (${response.status})`);
          await writeFile(join(dir, name, `${provider}.mp4`), Buffer.from(await response.arrayBuffer()));
          console.log(`OK   ${name} ${provider}: queue ${result.timing.queueMs} ms, processing ${result.timing.processingMs} ms`);
        } catch (error) {
          console.error(`FAIL ${name} ${provider}: ${describeFalError(error)}`);
        }
      }
    }),
  );
}

main().catch((error) => {
  console.error(describeFalError(error));
  process.exitCode = 1;
});
