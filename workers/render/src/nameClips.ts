import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  derivedFiles,
  nameClipCacheKey,
  storageKeys,
  type MasterConfig,
  type ObjectStorage,
  type VideoLanguage,
} from "@santa/core";
import { format, getMessages } from "@santa/core/i18n";
import { and, eq, getDb, nameClips, namePronunciations, sql } from "@santa/db";
import { writeFittedGreeting, trimGreeting } from "./audio";
import { StageError, stage, stageCode } from "./errors";
import { LIPSYNC_MODEL, LIPSYNC_USD_PER_SECOND, lipsyncSlot } from "./lipsync";
import type { PreparedMaster } from "./master";
import { fitGreetingToSlot, nextTtsSpeed } from "./slotFit";
import { assertWithinCap, recordSpend } from "./spend";
import { TTS_USD_PER_CHAR, synthesizeGreeting } from "./tts";

/** A clip "rendering" for longer than this is assumed abandoned (crashed worker) and is taken over. */
const STALE_MS = 10 * 60_000;
const POLL_MS = 3_000;

export interface ReadyClip {
  id: string;
  cacheKey: string;
  clipKey: string;
  audioKey: string;
}

interface ClipRequest {
  nameKey: string;
  displayName: string;
  language: VideoLanguage;
  source: "order" | "library";
}

/**
 * Returns the library clip for this name, rendering it on first use (lazy library).
 * Concurrent orders for the same new name render it once: the unique cache_key row is the lock.
 */
export async function getOrCreateNameClip(
  req: ClipRequest,
  ctx: { master: MasterConfig; prepared: PreparedMaster; storage: ObjectStorage },
): Promise<ReadyClip> {
  const db = getDb();
  const [pron] = await db
    .select({ respelling: namePronunciations.respelling })
    .from(namePronunciations)
    .where(and(eq(namePronunciations.nameKey, req.nameKey), eq(namePronunciations.language, req.language)))
    .limit(1);
  const pronunciation = pron?.respelling;
  const cacheKey = nameClipCacheKey({
    nameKey: req.nameKey,
    language: req.language,
    voiceId: ctx.master.voiceId,
    masterVersion: ctx.master.version,
    lipsyncModel: LIPSYNC_MODEL,
    pronunciation,
  });

  const deadline = Date.now() + STALE_MS + 60_000;
  for (;;) {
    const claimed = await claim(cacheKey, req, ctx.master);
    if (claimed.kind === "ready") return claimed.clip;
    if (claimed.kind === "mine") return render(claimed.id, cacheKey, req, pronunciation, ctx);
    if (Date.now() > deadline) throw new StageError("lipsync_failed", "Timed out waiting for another worker's clip");
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

type Claim = { kind: "ready"; clip: ReadyClip } | { kind: "mine"; id: string } | { kind: "wait" };

async function claim(cacheKey: string, req: ClipRequest, master: MasterConfig): Promise<Claim> {
  const db = getDb();
  const inserted = await db
    .insert(nameClips)
    .values({
      cacheKey,
      nameKey: req.nameKey,
      language: req.language,
      voiceId: master.voiceId,
      masterVersion: master.version,
      lipsyncModel: LIPSYNC_MODEL,
      source: req.source,
    })
    .onConflictDoNothing()
    .returning({ id: nameClips.id });
  if (inserted[0]) return { kind: "mine", id: inserted[0].id };

  const [row] = await db.select().from(nameClips).where(eq(nameClips.cacheKey, cacheKey)).limit(1);
  if (!row) return { kind: "wait" };
  if (row.status === "ready" && row.clipKey && row.audioKey) {
    return { kind: "ready", clip: { id: row.id, cacheKey, clipKey: row.clipKey, audioKey: row.audioKey } };
  }
  // Take over failed or abandoned renders (one winner thanks to the conditional update).
  const takeover = await db
    .update(nameClips)
    .set({ status: "rendering", createdAt: new Date(), errorCode: null })
    .where(
      and(
        eq(nameClips.id, row.id),
        sql`(${nameClips.status} = 'failed' or (${nameClips.status} = 'rendering' and ${nameClips.createdAt} < now() - interval '10 minutes'))`,
      ),
    )
    .returning({ id: nameClips.id });
  return takeover[0] ? { kind: "mine", id: takeover[0].id } : { kind: "wait" };
}

async function render(
  id: string,
  cacheKey: string,
  req: ClipRequest,
  pronunciation: string | undefined,
  ctx: { master: MasterConfig; prepared: PreparedMaster; storage: ObjectStorage },
): Promise<ReadyClip> {
  const { master, prepared, storage } = ctx;
  const dir = await mkdtemp(join(tmpdir(), "santa-clip-"));
  try {
    const text = format(getMessages(req.language).santa.greeting, { name: pronunciation ?? req.displayName });
    const lipsyncEstimate = prepared.slot.seconds * LIPSYNC_USD_PER_SECOND;

    // 1. Greeting TTS, retried faster if it can't fit the slot.
    let speed = master.tts.speed;
    let fitted: string | undefined;
    for (let attempt = 0; !fitted; attempt++) {
      await assertWithinCap(text.length * TTS_USD_PER_CHAR + lipsyncEstimate);
      const mp3 = await stage("tts_failed", () => synthesizeGreeting(master, text, speed));
      await recordSpend("elevenlabs", text.length * TTS_USD_PER_CHAR, `${text.length} chars`);
      const trimmed = await stage("fit_failed", () => trimGreeting(mp3, dir, String(attempt)));
      const fit = fitGreetingToSlot(trimmed.seconds, prepared.slot.seconds, master.greetingOffset);
      if (fit.action === "retryFaster") {
        const next = nextTtsSpeed(speed);
        if (next === undefined) throw new StageError("fit_failed", "Greeting too long for the name slot", false);
        speed = next;
        continue;
      }
      fitted = join(dir, "greeting.wav");
      await stage("fit_failed", () => writeFittedGreeting(trimmed.path, fit, prepared.slot.seconds, fitted!));
    }

    // 2. Lip-sync the slot (the only per-name video cost).
    await assertWithinCap(lipsyncEstimate);
    const clipPath = join(dir, "clip.mp4");
    await stage("lipsync_failed", () => lipsyncSlot(derivedFiles.slot(master), fitted, clipPath));
    await recordSpend("fal-sync-lipsync-2-pro", lipsyncEstimate, `${prepared.slot.seconds.toFixed(2)} s`);

    const clipKey = storageKeys.nameClip(cacheKey);
    const audioKey = storageKeys.nameAudio(cacheKey);
    await storage.putFile(clipKey, clipPath);
    await storage.putFile(audioKey, fitted);
    await getDb()
      .update(nameClips)
      .set({ status: "ready", clipKey, audioKey, readyAt: new Date(), costUsd: lipsyncEstimate.toFixed(4) })
      .where(eq(nameClips.id, id));
    return { id, cacheKey, clipKey, audioKey };
  } catch (error) {
    await getDb().update(nameClips).set({ status: "failed", errorCode: stageCode(error) }).where(eq(nameClips.id, id));
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
