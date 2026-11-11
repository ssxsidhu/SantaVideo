/**
 * Phase 0 lip-sync benchmark runner.
 *
 *   npm run bench:run -- benchmark/cases.json            # dry run: prints the spend estimate only
 *   npm run bench:run -- benchmark/cases.json --confirm  # actually calls the providers
 *
 * Refuses to run when the estimate exceeds BENCH_BUDGET_USD (default $20, per working agreements).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { REPO_ROOT, loadConfig, type LipsyncProviderId } from "./config.js";
import { lipsyncCost } from "./costModel.js";
import { createClient, describeFalError, loadProviderEndpoints, runLipsync, uploadFile, type LipsyncTiming } from "./falProvider.js";
import { probeDurationSeconds } from "./media.js";

interface BenchCase {
  id: string;
  description: string;
  /** Local path to the master segment (video) to re-lip-sync. */
  video: string;
  /** Local path to the new speech audio. */
  audio: string;
  providers: LipsyncProviderId[];
}

interface PlannedJob {
  benchCase: BenchCase;
  provider: LipsyncProviderId;
  audioSeconds: number;
  estimatedUsd: number;
}

interface JobRecord {
  caseId: string;
  provider: LipsyncProviderId;
  audioSeconds: number;
  estimatedUsd: number;
  ok: boolean;
  timing?: LipsyncTiming;
  outputFile?: string;
  error?: string;
}

const OUT_DIR = join(REPO_ROOT, "benchmark", "out");
const MAX_PARALLEL_JOBS = 2; // fal's starting concurrency for new accounts

async function planJobs(cases: BenchCase[]): Promise<PlannedJob[]> {
  const { rates } = loadConfig();
  const endpoints = loadProviderEndpoints();
  const jobs: PlannedJob[] = [];
  for (const benchCase of cases) {
    const audioSeconds = await probeDurationSeconds(resolve(REPO_ROOT, benchCase.audio));
    for (const provider of benchCase.providers) {
      if (!endpoints[provider]) throw new Error(`Case ${benchCase.id}: no endpoint configured for ${provider}`);
      jobs.push({ benchCase, provider, audioSeconds, estimatedUsd: lipsyncCost(rates.lipsync[provider], audioSeconds) });
    }
  }
  return jobs;
}

async function downloadTo(url: string, path: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

/** Runs async tasks with a fixed concurrency limit, preserving result order. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main(): Promise<void> {
  const casesPath = process.argv[2];
  if (!casesPath) throw new Error("Usage: bench:run -- <cases.json> [--confirm]");
  const confirmed = process.argv.includes("--confirm");
  const budgetUsd = Number(process.env.BENCH_BUDGET_USD ?? 20);

  const cases = JSON.parse(readFileSync(resolve(REPO_ROOT, casesPath), "utf8")) as BenchCase[];
  const jobs = await planJobs(cases);
  const totalUsd = jobs.reduce((sum, job) => sum + job.estimatedUsd, 0);

  console.table(jobs.map((j) => ({ case: j.benchCase.id, provider: j.provider, seconds: j.audioSeconds.toFixed(1), usd: j.estimatedUsd.toFixed(3) })));
  console.log(`Estimated lip-sync spend: $${totalUsd.toFixed(2)} (budget $${budgetUsd})`);

  if (totalUsd > budgetUsd) throw new Error("Estimate exceeds BENCH_BUDGET_USD - get owner approval and raise the budget explicitly.");
  if (!confirmed) {
    console.log("Dry run only. Re-run with --confirm to call the providers.");
    return;
  }

  const client = createClient();
  const endpoints = loadProviderEndpoints();
  const uploads = new Map<string, Promise<string>>();
  const upload = (path: string) => {
    const full = resolve(REPO_ROOT, path);
    if (!uploads.has(full)) uploads.set(full, uploadFile(client, full));
    return uploads.get(full)!;
  };

  mkdirSync(join(OUT_DIR, "videos"), { recursive: true });
  mkdirSync(join(OUT_DIR, "results"), { recursive: true });

  const records = await mapWithConcurrency(jobs, MAX_PARALLEL_JOBS, async (job): Promise<JobRecord> => {
    const base = { caseId: job.benchCase.id, provider: job.provider, audioSeconds: job.audioSeconds, estimatedUsd: job.estimatedUsd };
    try {
      const [videoUrl, audioUrl] = await Promise.all([upload(job.benchCase.video), upload(job.benchCase.audio)]);
      const result = await runLipsync(client, job.provider, endpoints[job.provider]!, videoUrl, audioUrl);
      const outputFile = join(OUT_DIR, "videos", `${job.benchCase.id}__${job.provider}.mp4`);
      await downloadTo(result.outputUrl, outputFile);
      console.log(`OK   ${job.benchCase.id} / ${job.provider} in ${(result.timing.totalMs / 1000).toFixed(1)}s`);
      return { ...base, ok: true, timing: result.timing, outputFile };
    } catch (error) {
      const reason = describeFalError(error);
      console.error(`FAIL ${job.benchCase.id} / ${job.provider}: ${reason}`);
      return { ...base, ok: false, error: reason };
    }
  });

  const resultPath = join(OUT_DIR, "results", `run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(resultPath, JSON.stringify(records, null, 2));
  console.log(`Results written to ${resultPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
