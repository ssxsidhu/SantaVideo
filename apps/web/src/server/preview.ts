import "server-only";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { END_CARD_STYLE, derivedFiles, getMaster, previewImageFilter, runTool, storageKeys, type VideoLanguage } from "@santa/core";
import { format, getMessages, type Locale } from "@santa/core/i18n";
import { repo, storage } from "./context";

/**
 * Watermarked still of the end card with the child's name: free, instant, no vendor call before payment.
 * Cached by a hash (the name never appears in a file name).
 */
export async function previewImageKey(input: { childName: string; language: VideoLanguage; locale: Locale }): Promise<string> {
  const master = getMaster(input.language, repo());
  const plate = derivedFiles.plate(master);
  if (!existsSync(plate)) throw new Error("Master plate missing: run `npm run master:prepare`");

  const t = getMessages(input.locale);
  const title = format(t.santa.endCardTitle, { name: input.childName });
  const signature = t.santa.endCardSignature;
  const hash = createHash("sha256")
    .update(["preview-v3", END_CARD_STYLE, master.version, input.locale, title, signature].join("\n"))
    .digest("hex")
    .slice(0, 32);
  const key = storageKeys.preview(hash);
  const store = storage();
  if (await store.exists(key)) return key;

  const dir = await mkdtemp(join(tmpdir(), "santa-preview-"));
  try {
    const out = join(dir, "preview.jpg");
    await runTool("ffmpeg", [
      "-v", "error", "-y",
      "-i", plate,
      "-vf", previewImageFilter({ title, signature, watermark: t.preview.watermark }),
      "-frames:v", "1", "-q:v", "4",
      out,
    ]);
    await store.put(key, await readFile(out));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return key;
}
