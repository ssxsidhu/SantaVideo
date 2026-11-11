/** BullMQ contract shared by the web app (producer) and the render worker (consumer). */
export const RENDER_QUEUE = "render";

/** Job payload carries IDs only, never a name or email (Redis contents are not encrypted). */
export interface RenderJobData {
  videoId: string;
}

/** One job per video: re-enqueueing the same video (webhook redelivery) is a no-op. */
export function renderJobId(videoId: string): string {
  return `video-${videoId}`;
}

/** Parses REDIS_URL into the options BullMQ/ioredis expect. */
export function redisConnectionFromEnv(): { host: string; port: number; password?: string; username?: string; maxRetriesPerRequest: null } {
  const raw = process.env.REDIS_URL;
  if (!raw) throw new Error("REDIS_URL is not set (see .env.example and CLAUDE.md 'Server')");
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    maxRetriesPerRequest: null,
  };
}
