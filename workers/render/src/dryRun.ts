/** Free pipeline check: assembles with the master's own slot as the "lip-synced" clip (no vendor calls). */
import { derivedFiles, findRepoRoot, getMaster } from "@santa/core";
import { assembleVideo } from "./assemble";
import { loadPrepared } from "./master";

const [greeting, out, name = "Emma"] = process.argv.slice(2);
if (!greeting || !out) throw new Error("Usage: tsx src/dryRun.ts <slot-audio.wav> <out.mp4> [name]");
const master = getMaster("en", findRepoRoot());
const started = Date.now();
await assembleVideo({
  master,
  prepared: await loadPrepared(master),
  clip: derivedFiles.slot(master),
  greeting,
  endCard: { title: `Merry Christmas, ${name}!`, signature: "Love, Santa" },
  outPath: out,
});
console.log(`assembled in ${((Date.now() - started) / 1000).toFixed(1)} s -> ${out}`);
