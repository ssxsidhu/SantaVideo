import "server-only";
import { findRepoRoot, getStorage, type ObjectStorage } from "@santa/core";

let repoRoot: string | undefined;

export function repo(): string {
  repoRoot ??= findRepoRoot();
  return repoRoot;
}

export function storage(): ObjectStorage {
  return getStorage(repo());
}

/** Public origin for links we hand to Stripe and emails (no trailing slash). */
export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
