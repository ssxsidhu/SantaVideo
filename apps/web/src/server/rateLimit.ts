import "server-only";

/**
 * Fixed-window limiter per client key. In-memory: fine for one web process in Phase 1.
 * TODO(Phase 4): move to Redis so limits hold across processes and restarts.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function allowRequest(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/** Client IP from the reverse proxy (nginx sets X-Forwarded-For); used only as a rate-limit key, never logged. */
export function clientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}
