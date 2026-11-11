import "server-only";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { RENDER_QUEUE, redisConnectionFromEnv, renderJobId, type RenderJobData } from "@santa/core";
import type { RenderEnqueuer } from "./webhook";

let queue: Queue<RenderJobData> | undefined;

function renderQueue(): Queue<RenderJobData> {
  // BullMQ 6 in ESM needs a constructed client (ioredis is an optional peer, not bundled).
  queue ??= new Queue<RenderJobData>(RENDER_QUEUE, { connection: new Redis(redisConnectionFromEnv()) });
  return queue;
}

export const bullRenderEnqueuer: RenderEnqueuer = {
  async enqueue(videoId) {
    await renderQueue().add(
      "video",
      { videoId },
      {
        jobId: renderJobId(videoId),
        attempts: 4,
        backoff: { type: "exponential", delay: 15_000 },
        removeOnComplete: { age: 7 * 24 * 3600 },
        removeOnFail: false, // failed jobs stay visible (dead-letter view in admin, Phase 4)
      },
    );
  },
};
