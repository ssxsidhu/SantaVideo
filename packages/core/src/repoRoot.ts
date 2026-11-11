import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Repo root, found by walking up from the current working directory to the folder holding config/pricing.json.
 * Works for the web app (cwd apps/web), the worker (cwd workers/render) and scripts run from the root.
 */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, "config", "pricing.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Could not find the repo root above ${start}`);
    dir = parent;
  }
}
