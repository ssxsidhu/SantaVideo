import { derivedFiles, endCardFilter, probeDurationSeconds, runTool, type EndCardText, type MasterConfig } from "@santa/core";
import { FPS, type PreparedMaster } from "./master";

const END_CARD_SECONDS = 5;
const END_CARD_XFADE = 0.6;
const JOIN = 0.04; // audio fade at each splice
const MASK_FEATHER = 30;

export interface AssembleInput {
  master: MasterConfig;
  prepared: PreparedMaster;
  /** Lip-synced slot clip from Sync (may be shorter than the slot: it stops at the end of speech). */
  clip: string;
  /** Slot-length greeting WAV that replaces the master's voice in the slot. */
  greeting: string;
  endCard: EndCardText;
  outPath: string;
}

/**
 * Final video: master body with the mouth-only lip-sync overlay in the name slot, the voice stem with the
 * greeting spliced in BEFORE the music mix, music ducked under the voice, then the personalized end card.
 */
export async function assembleVideo(input: AssembleInput): Promise<void> {
  const { master, prepared, endCard } = input;
  const S = prepared.slot.start;
  const slotSeconds = prepared.slot.seconds;
  const talkSeconds = prepared.voiceSeconds;
  const total = talkSeconds + END_CARD_SECONDS - END_CARD_XFADE;
  const clipSeconds = Math.min(await probeDurationSeconds(input.clip), slotSeconds);
  const { cx, cy, rx, ry } = master.mouthMask;

  const filter = [
    `[0:v]trim=duration=${talkSeconds.toFixed(3)},setpts=PTS-STARTPTS,settb=1/${FPS}[base]`,
    // Sync tags its output bt709; clear the tags so the overlay keeps the master's colors exactly.
    `[4:v]trim=duration=${clipSeconds.toFixed(3)},setpts=PTS-STARTPTS,setparams=range=tv:color_primaries=unknown:color_trc=unknown:colorspace=unknown,` +
      `scale=1920:1080,fps=${FPS},format=yuv420p,setsar=1[clipraw]`,
    `color=c=black:s=1920x1080:r=${FPS}:d=${clipSeconds.toFixed(3)},format=gray,` +
      `geq=lum='255*lte(((X-${cx})/${rx})*((X-${cx})/${rx})+((Y-${cy})/${ry})*((Y-${cy})/${ry}),1)',boxblur=${MASK_FEATHER}:2[mask]`,
    `[clipraw][mask]alphamerge,setpts=PTS-STARTPTS+${S.toFixed(3)}/TB,settb=1/${FPS}[clip]`,
    `[base][clip]overlay=eof_action=pass:enable='between(t,${S.toFixed(3)},${(S + clipSeconds - 0.001).toFixed(3)})',settb=1/${FPS}[body]`,
    `[1:v]scale=1920:1080,fps=${FPS},setsar=1,format=yuv420p,${endCardFilter(END_CARD_SECONDS, endCard)},settb=1/${FPS}[card]`,
    `[body][card]xfade=transition=fade:duration=${END_CARD_XFADE}:offset=${(talkSeconds - END_CARD_XFADE).toFixed(3)},format=yuv420p[v]`,
    // Voice stem: master voice with the slot replaced by the greeting.
    `[2:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${talkSeconds.toFixed(3)},asplit=2[t0][t1]`,
    `[t0]atrim=0:${S.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=out:st=${(S - JOIN).toFixed(3)}:d=${JOIN}[pre]`,
    `[5:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${slotSeconds.toFixed(3)},asetpts=PTS-STARTPTS,` +
      `afade=t=in:d=${JOIN},afade=t=out:st=${(slotSeconds - JOIN).toFixed(3)}:d=${JOIN}[greet]`,
    `[t1]atrim=start=${(S + slotSeconds).toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=${JOIN}[post]`,
    `anullsrc=r=48000:cl=stereo,atrim=0:${(END_CARD_SECONDS - END_CARD_XFADE).toFixed(3)}[tail]`,
    `[pre][greet][post][tail]concat=n=4:v=0:a=1,asplit=2[voice][key]`,
    `[3:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,` +
      `volume=0.55,afade=t=in:d=1.5,afade=t=out:st=${(total - 3).toFixed(3)}:d=3[music]`,
    `[music][key]sidechaincompress=threshold=0.03:ratio=10:attack=30:release=600[ducked]`,
    `[voice][ducked]amix=inputs=2:weights='1 1':normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`,
  ].join(";");

  await runTool("ffmpeg", [
    "-v", "error", "-y",
    "-i", derivedFiles.body(master),
    "-loop", "1", "-t", String(END_CARD_SECONDS), "-i", derivedFiles.plate(master),
    "-i", master.voiceTrack,
    "-i", master.music,
    "-i", input.clip,
    "-i", input.greeting,
    "-filter_complex", filter,
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-r", String(FPS), "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
    input.outPath,
  ]);
}
