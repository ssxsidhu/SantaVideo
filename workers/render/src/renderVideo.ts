import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { END_CARD_STYLE, finalVideoCacheKey, storageKeys, type MasterConfig, type ObjectStorage, type VideoLanguage } from "@santa/core";
import { format, getMessages } from "@santa/core/i18n";
import { assembleVideo } from "./assemble";
import { stage } from "./errors";
import type { PreparedMaster } from "./master";
import type { ReadyClip } from "./nameClips";

/** Builds (or reuses) the final video for a clip + end card. Same name + same card = same file. */
export async function ensureFinalVideo(
  clip: ReadyClip,
  card: { displayName: string; language: VideoLanguage; campaignId?: string },
  ctx: { master: MasterConfig; prepared: PreparedMaster; storage: ObjectStorage },
): Promise<string> {
  const t = getMessages(card.language).santa;
  const endCard = { title: format(t.endCardTitle, { name: card.displayName }), signature: t.endCardSignature };
  const key = storageKeys.finalVideo(finalVideoCacheKey(clip.cacheKey, { displayName: endCard.title, campaignId: card.campaignId, style: END_CARD_STYLE }));
  if (await ctx.storage.exists(key)) return key;

  const dir = await mkdtemp(join(tmpdir(), "santa-final-"));
  try {
    const out = join(dir, "final.mp4");
    const clipFile = join(dir, "clip.mp4");
    const greetingFile = join(dir, "greeting.wav");
    await stage("assemble_failed", async () => {
      await Promise.all([ctx.storage.getToFile(clip.clipKey, clipFile), ctx.storage.getToFile(clip.audioKey, greetingFile)]);
      await assembleVideo({ master: ctx.master, prepared: ctx.prepared, clip: clipFile, greeting: greetingFile, endCard, outPath: out });
    });
    await ctx.storage.putFile(key, out);
    return key;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
