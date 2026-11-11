/**
 * Renders the landing-page sample (public name, library clip) into samples/en.mp4 + samples/en.jpg.
 *
 *   npm run sample -- Emma
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findRepoRoot, getMaster, getStorage, runTool, validateFirstName } from "@santa/core";
import { closeDb } from "@santa/db";
import { loadPrepared } from "./master";
import { getOrCreateNameClip } from "./nameClips";
import { ensureFinalVideo } from "./renderVideo";

async function main(): Promise<void> {
  const name = validateFirstName(process.argv[2] ?? "Emma");
  if (!name.ok) throw new Error(`Invalid sample name (${name.reason})`);
  const repoRoot = findRepoRoot();
  const storage = getStorage(repoRoot);
  const master = getMaster("en", repoRoot);
  const ctx = { master, prepared: await loadPrepared(master), storage };

  const clip = await getOrCreateNameClip({ nameKey: name.nameKey, displayName: name.displayName, language: "en", source: "library" }, ctx);
  const finalKey = await ensureFinalVideo(clip, { displayName: name.displayName, language: "en" }, ctx);

  const dir = await mkdtemp(join(tmpdir(), "santa-sample-"));
  try {
    const video = join(dir, "sample.mp4");
    const poster = join(dir, "poster.jpg");
    await storage.getToFile(finalKey, video);
    await storage.putFile("samples/en.mp4", video);
    await runTool("ffmpeg", ["-v", "error", "-y", "-ss", "4", "-i", video, "-frames:v", "1", "-vf", "scale=1280:720", "-q:v", "4", poster]);
    await storage.put("samples/en.jpg", await readFile(poster));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  console.log(`Sample ready in ${storage.kind} storage: samples/en.mp4`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
