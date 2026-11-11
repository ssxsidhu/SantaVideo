/**
 * Render worker: consumes "render" jobs ({ videoId }) queued by the Stripe webhook.
 *
 *   npm run worker          (SSH tunnel open; needs FAL_KEY + ELEVENLABS_API_KEY for new names)
 *
 * Logs carry video ids and stage codes only, never names or emails.
 */
import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { RENDER_QUEUE, findRepoRoot, getMaster, getStorage, redisConnectionFromEnv, type RenderJobData } from "@santa/core";
import { closeDb, eq, getDb, sql, videos } from "@santa/db";
import { StageError, stageCode } from "./errors";
import { loadPrepared } from "./master";
import { getOrCreateNameClip } from "./nameClips";
import { ensureFinalVideo } from "./renderVideo";
import { sendVideoReadyEmail } from "./email";

const repoRoot = findRepoRoot();
const storage = getStorage(repoRoot);

async function processVideo(job: Job<RenderJobData>): Promise<void> {
  const { videoId } = job.data;
  const db = getDb();
  const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
  if (!video) return console.warn(`[render] video ${videoId}: not found, dropping job`);
  if (video.status === "ready") return;
  if (video.status === "awaiting_payment") return console.warn(`[render] video ${videoId}: not paid, dropping job`);
  if (!video.childName || !video.nameKey) throw new StageError("data_deleted", "Name was deleted", false);

  await db
    .update(videos)
    .set({ status: "rendering", attempts: sql`${videos.attempts} + 1`, errorCode: null })
    .where(eq(videos.id, videoId));
  const started = Date.now();

  const master = getMaster(video.language, repoRoot);
  const ctx = { master, prepared: await loadPrepared(master), storage };
  const clip = await getOrCreateNameClip(
    { nameKey: video.nameKey, displayName: video.childName, language: video.language, source: "order" },
    ctx,
  );
  const finalKey = await ensureFinalVideo(clip, { displayName: video.childName, language: video.language }, ctx);

  await db
    .update(videos)
    .set({ status: "ready", finalKey, nameClipId: clip.id, readyAt: new Date() })
    .where(eq(videos.id, videoId));
  console.log(`[render] video ${videoId}: ready in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  await sendVideoReadyEmail(videoId);
}

const worker = new Worker<RenderJobData>(
  RENDER_QUEUE,
  async (job) => {
    try {
      await processVideo(job);
    } catch (error) {
      const code = stageCode(error);
      const finalAttempt = !(error instanceof StageError && error.retryable) || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await getDb()
        .update(videos)
        .set({ status: finalAttempt ? "failed" : "queued", errorCode: code })
        .where(eq(videos.id, job.data.videoId));
      console.error(`[render] video ${job.data.videoId}: ${code}${finalAttempt ? " (giving up)" : " (will retry)"}`);
      if (!finalAttempt) throw error;
      // Non-retryable: finish the job so BullMQ doesn't retry; the video row shows the failure.
    }
  },
  // One render at a time: ffmpeg at 1080p uses all cores on the 2-vCPU VPS.
  { connection: new Redis(redisConnectionFromEnv()), concurrency: Number(process.env.RENDER_CONCURRENCY ?? 1) },
);

worker.on("ready", () => console.log(`[render] worker listening on "${RENDER_QUEUE}"`));
worker.on("error", (error) => console.error("[render] worker error:", error.message));

async function shutdown(): Promise<void> {
  console.log("[render] shutting down");
  await worker.close();
  await closeDb();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
