/**
 * Assembles master v2: silent reading shot -> hard cut (on the look-up) -> one continuous talking take -> end card,
 * with the voice track and a music bed that ducks under Santa's voice. Both shots are OmniHuman 720p, upscaled here.
 *
 *   npm run bench:assemble-take                         # generic end card
 *   npm run bench:assemble-take -- --name=Emma          # personalized end card
 *   npm run bench:assemble-take -- --reading=3.4        # cut out of the reading shot earlier (seconds)
 *
 * Output: 1920x1080, 25 fps, H.264 + AAC, -16 LUFS, plus master-en-v2.final-manifest.json with the name slot.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { REPO_ROOT } from "./config.js";
import { endCardFilter, validateDisplayName } from "./endCard.js";
import { probeDurationSeconds, runTool } from "./media.js";

const MASTERS = join(REPO_ROOT, "benchmark", "out", "masters");
const AUDIO = join(REPO_ROOT, "benchmark", "out", "audio", "master-en-v3");
const ASSETS = join(REPO_ROOT, "benchmark", "assets", "master");

const READING_SHOT = join(MASTERS, "master-en-v4-reading__omnihuman-720p.mp4");
const TALK_SHOT = join(MASTERS, "master-en-v4-talk__omnihuman-720p.mp4");
const TALK_AUDIO = join(AUDIO, "talk.wav");
const MUSIC = join(ASSETS, "music-bed-en.mp3");
const END_CARD_PLATE = join(ASSETS, "santa-closeup_1920x1080.png");

const DEFAULT_READING_SECONDS = 4.0;
const END_CARD_SECONDS = 5;
const END_CARD_XFADE_SECONDS = 0.6;
/** Silence the talk track starts with (talk.wav lead-in) and where the name slot sits inside it. */
const TALK_LEAD_IN_SECONDS = 0.3;
const NAME_SLOT_IN_TALK = { start: 3.934, end: 6.221 };
const FPS = 25;
const UPSCALE = `scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,unsharp=5:5:0.5:5:5:0.0,fps=${FPS},setsar=1,format=yuv420p`;

function stringFlag(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function numberFlag(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`--${name} must be a positive number`);
  return value;
}

async function main(): Promise<void> {
  const nameArg = process.argv.find((a) => a.startsWith("--name="))?.slice("--name=".length);
  const name = nameArg ? validateDisplayName(nameArg) : undefined;

  const talkShot = stringFlag("talk-shot") ? resolve(stringFlag("talk-shot")!) : TALK_SHOT;
  for (const path of [READING_SHOT, talkShot, TALK_AUDIO, MUSIC, END_CARD_PLATE]) {
    if (!existsSync(path)) throw new Error(`Missing input: ${path}`);
  }

  const readingSeconds = Math.min(numberFlag("reading", DEFAULT_READING_SECONDS), await probeDurationSeconds(READING_SHOT));
  // Dissolve from the reading shot into the talking take (0 = hard cut). Both start from the same framing.
  const openXfade = stringFlag("open-xfade") ? numberFlag("open-xfade", 0) : 0;
  const talkOffset = readingSeconds - openXfade; // where the talking take (and its audio) starts on the final timeline
  const talkSeconds = await probeDurationSeconds(TALK_AUDIO);
  const talkEnd = talkOffset + talkSeconds;
  const totalSeconds = talkEnd + END_CARD_SECONDS - END_CARD_XFADE_SECONDS;

  // Insert: borrow a stretch of another take recorded on the same audio (e.g. Santa looking down at the letter),
  // "file:sourceStart:talkStart:seconds", dissolved in and out over the talking take.
  const insertArg = stringFlag("insert");
  const insertParts = insertArg?.split(/:(?=[\d.]+(?::|$))/);
  const insert = insertParts
    ? { file: resolve(insertParts[0]!), src: Number(insertParts[1]), at: Number(insertParts[2]), dur: Number(insertParts[3]) }
    : undefined;
  if (insert && (!existsSync(insert.file) || [insert.src, insert.at, insert.dur].some((v) => !Number.isFinite(v) || v < 0))) {
    throw new Error("--insert must be file:sourceStart:talkStart:seconds with an existing file");
  }
  const INSERT_FADE = 0.16;

  // Name swap: a lip-synced 1080p clip of the slot (cut from a previous assembly) plus its slot-length greeting audio.
  // The clip is overlaid on the picture and the greeting replaces the voice stem *before* the music mix.
  const slotClip = stringFlag("slot-clip");
  const slotAudio = stringFlag("slot-audio");
  const slotStart = numberFlag("slot-start", 0); // seconds on the final timeline (frame-aligned)
  if ((slotClip || slotAudio) && !(slotClip && slotAudio && slotStart > 0)) {
    throw new Error("Name swap needs --slot-clip, --slot-audio and --slot-start together");
  }
  const swap = slotClip && slotAudio ? { clip: resolve(slotClip), audio: resolve(slotAudio), start: slotStart } : undefined;
  const swapSeconds = swap ? await probeDurationSeconds(swap.clip) : 0;
  const swapInTalk = swap ? swap.start - talkOffset : 0;
  const insertInput = swap ? 7 : 5;
  const JOIN = 0.04;
  const MASK_FEATHER = 30;
  const maskArg = stringFlag("mouth-mask"); // "cx,cy,rx,ry" in 1920x1080 pixels
  const maskValues = maskArg?.split(",").map(Number);
  if (maskValues && (maskValues.length !== 4 || maskValues.some((v) => !Number.isFinite(v) || v <= 0))) {
    throw new Error("--mouth-mask must be cx,cy,rx,ry (positive pixels)");
  }
  const mask = swap && maskValues ? { cx: maskValues[0]!, cy: maskValues[1]!, rx: maskValues[2]!, ry: maskValues[3]! } : undefined;

  const voiceChain = swap
    ? [
        `[3:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[t0][t1]`,
        `[t0]atrim=0:${swapInTalk},asetpts=PTS-STARTPTS,afade=t=out:st=${swapInTalk - JOIN}:d=${JOIN}[pre]`,
        `[6:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${swapSeconds},asetpts=PTS-STARTPTS,afade=t=in:d=${JOIN},afade=t=out:st=${swapSeconds - JOIN}:d=${JOIN}[greet]`,
        `[t1]atrim=start=${swapInTalk + swapSeconds},asetpts=PTS-STARTPTS,afade=t=in:d=${JOIN}[post]`,
        `[pre][greet][post]concat=n=3:v=0:a=1[talka]`,
      ]
    : [`[3:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[talka]`];

  const filter = [
    // Reading shot -> hard cut -> talking take (trimmed to its exact audio length; OmniHuman pads to whole seconds).
    `[0:v]trim=duration=${readingSeconds},setpts=PTS-STARTPTS,${UPSCALE}[read]`,
    `[1:v]trim=duration=${talkSeconds},setpts=PTS-STARTPTS,${UPSCALE}${insert ? "[talkraw]" : "[talk]"}`,
    ...(insert
      ? [
          `[${insertInput}:v]trim=start=${insert.src}:duration=${insert.dur},setpts=PTS-STARTPTS,${UPSCALE},format=yuva420p,` +
            `fade=t=in:d=${INSERT_FADE}:alpha=1,fade=t=out:st=${insert.dur - INSERT_FADE}:d=${INSERT_FADE}:alpha=1,setpts=PTS+${insert.at}/TB[ins]`,
          `[talkraw][ins]overlay=eof_action=pass,format=yuv420p[talk]`,
        ]
      : []),
    // xfade needs identical timebases on both inputs; concat and the looped still otherwise disagree.
    `[read]settb=1/${FPS}[read2]`,
    `[talk]settb=1/${FPS}[talk2]`,
    openXfade > 0
      ? `[read2][talk2]xfade=transition=fade:duration=${openXfade}:offset=${talkOffset.toFixed(3)},settb=1/${FPS}[joined]`
      : `[read2][talk2]concat=n=2:v=1:a=0,settb=1/${FPS}[joined]`,
    ...(swap
      ? [
          `[joined]null[base]`,
          // Sync tags its output bt709 while our upscaled picture is untagged; without clearing the tags, swscale
          // converts the clip's color matrix and the slot shifts warmer. Same pixel values in, same values out.
          `[5:v]setparams=range=tv:color_primaries=unknown:color_trc=unknown:colorspace=unknown,fps=${FPS},format=yuv420p,setsar=1${mask ? "[clipraw]" : `,setpts=PTS-STARTPTS+${swap.start}/TB,settb=1/${FPS}[clip]`}`,
          // Optional soft oval around the mouth: only lip-sync pixels inside it are used, the master shows elsewhere.
          ...(mask
            ? [
                `color=c=black:s=1920x1080:r=${FPS}:d=${swapSeconds},format=gray,` +
                  `geq=lum='255*lte(((X-${mask.cx})/${mask.rx})*((X-${mask.cx})/${mask.rx})+((Y-${mask.cy})/${mask.ry})*((Y-${mask.cy})/${mask.ry}),1)',boxblur=${MASK_FEATHER}:2[mask]`,
                `[clipraw][mask]alphamerge,setpts=PTS-STARTPTS+${swap.start}/TB,settb=1/${FPS}[clip]`,
              ]
            : []),
          `[base][clip]overlay=eof_action=pass:enable='between(t,${swap.start},${(swap.start + swapSeconds - 0.001).toFixed(3)})',settb=1/${FPS}[body]`,
        ]
      : [`[joined]null[body]`]),
    `[2:v]scale=1920:1080,fps=${FPS},setsar=1,format=yuv420p,${endCardFilter(END_CARD_SECONDS, name)},settb=1/${FPS}[card]`,
    `[body][card]xfade=transition=fade:duration=${END_CARD_XFADE_SECONDS}:offset=${(talkEnd - END_CARD_XFADE_SECONDS).toFixed(3)}[v]`,
    // Voice: silence under the reading shot, the talk track, silence under the end card.
    `anullsrc=r=48000:cl=stereo,atrim=0:${talkOffset}[sil0]`,
    ...voiceChain,
    `anullsrc=r=48000:cl=stereo,atrim=0:${END_CARD_SECONDS - END_CARD_XFADE_SECONDS}[sil1]`,
    `[sil0][talka][sil1]concat=n=3:v=0:a=1,asplit=2[voice][key]`,
    // Music: full length, fades, ducked by the voice through a sidechain compressor.
    `[4:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${totalSeconds},asetpts=PTS-STARTPTS,` +
      `volume=0.55,afade=t=in:d=1.5,afade=t=out:st=${totalSeconds - 3}:d=3[music]`,
    `[music][key]sidechaincompress=threshold=0.03:ratio=10:attack=30:release=600[ducked]`,
    `[voice][ducked]amix=inputs=2:weights='1 1':normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`,
  ].join(";");

  const tag = stringFlag("tag")?.replace(/[^a-z0-9-]/gi, "");
  const prefix = (stringFlag("out") ?? "master-en-v2").replace(/[^a-z0-9-]/gi, "");
  const base = name ? `${prefix}_${name.toLowerCase().replace(/[^\p{L}]+/gu, "-")}` : prefix;
  const outPath = join(MASTERS, `${base}${tag ? `_${tag}` : ""}.mp4`);
  writeFileSync(join(MASTERS, "last-take-filter.txt"), filter);
  await runTool("ffmpeg", [
    "-y",
    "-i", READING_SHOT,
    "-i", talkShot,
    "-loop", "1", "-t", String(END_CARD_SECONDS), "-i", END_CARD_PLATE,
    "-i", TALK_AUDIO,
    "-i", MUSIC,
    ...(swap ? ["-i", swap.clip, "-i", swap.audio] : []),
    ...(insert ? ["-i", insert.file] : []),
    "-filter_complex", filter,
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    outPath,
  ]);

  const manifest = {
    file: outPath,
    totalSeconds: +totalSeconds.toFixed(3),
    fps: FPS,
    readingShotSeconds: readingSeconds,
    talkStart: +talkOffset.toFixed(3),
    nameSlot: {
      start: +(talkOffset + NAME_SLOT_IN_TALK.start).toFixed(3),
      end: +(talkOffset + NAME_SLOT_IN_TALK.end).toFixed(3),
    },
    talkLeadInSeconds: TALK_LEAD_IN_SECONDS,
  };
  writeFileSync(join(MASTERS, `${prefix}.final-manifest.json`), JSON.stringify(manifest, null, 2));
  console.log(`Assembled ${totalSeconds.toFixed(1)}s -> ${outPath}`);
  console.log(`Name slot in final video: ${manifest.nameSlot.start}s - ${manifest.nameSlot.end}s`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
