import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createFalClient, type FalClient } from "@fal-ai/client";
import { REPO_ROOT, type LipsyncProviderId } from "./config.js";

interface ProviderEndpoint {
  endpoint: string;
  input: Record<string, unknown>;
  verified: boolean;
}

export interface LipsyncTiming {
  queueMs: number;
  processingMs: number;
  totalMs: number;
}

export interface LipsyncJobResult {
  provider: LipsyncProviderId;
  requestId: string;
  outputUrl: string;
  timing: LipsyncTiming;
}

export function loadProviderEndpoints(): Partial<Record<LipsyncProviderId, ProviderEndpoint>> {
  const raw = JSON.parse(readFileSync(join(REPO_ROOT, "benchmark", "providers.json"), "utf8")) as Record<string, unknown>;
  delete raw.$comment;
  return raw as Partial<Record<LipsyncProviderId, ProviderEndpoint>>;
}

/** fal's ApiError hides the useful reason (e.g. "Exhausted balance") in `body.detail`; surface it. */
export function describeFalError(error: unknown): string {
  const e = error as { status?: number; message?: string; body?: { detail?: unknown } };
  const detail = typeof e?.body?.detail === "string" ? e.body.detail : JSON.stringify(e?.body?.detail ?? "");
  return [e?.status ? `HTTP ${e.status}` : "", e?.message ?? String(error), detail].filter(Boolean).join(" - ");
}

export function createClient(): FalClient {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set (see .env.example)");
  return createFalClient({ credentials: key });
}

/** Uploads a local file to fal storage once and returns its CDN URL. */
export async function uploadFile(client: FalClient, path: string): Promise<string> {
  const bytes = readFileSync(path);
  const types: Record<string, string> = { mp4: "video/mp4", wav: "audio/wav", mp3: "audio/mpeg", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const type = types[ext];
  if (!type) throw new Error(`Unsupported upload type: .${ext}`);
  return client.storage.upload(new File([bytes], basename(path), { type }));
}

function extractVideoUrl(data: unknown): string {
  const url = (data as { video?: { url?: unknown } } | null)?.video?.url;
  if (typeof url !== "string") throw new Error(`Unexpected provider output: ${JSON.stringify(data).slice(0, 300)}`);
  return url;
}

/** Runs one lip-sync job through the fal queue and measures queue vs processing time. */
export async function runLipsync(
  client: FalClient,
  provider: LipsyncProviderId,
  endpoint: ProviderEndpoint,
  videoUrl: string,
  audioUrl: string,
): Promise<LipsyncJobResult> {
  const submittedAt = Date.now();
  let startedAt: number | undefined;

  const result = await client.subscribe(endpoint.endpoint, {
    input: { ...endpoint.input, video_url: videoUrl, audio_url: audioUrl },
    onQueueUpdate: (status) => {
      if (status.status !== "IN_QUEUE" && startedAt === undefined) startedAt = Date.now();
    },
  });

  const finishedAt = Date.now();
  const started = startedAt ?? submittedAt;
  return {
    provider,
    requestId: result.requestId,
    outputUrl: extractVideoUrl(result.data),
    timing: { queueMs: started - submittedAt, processingMs: finishedAt - started, totalMs: finishedAt - submittedAt },
  };
}
