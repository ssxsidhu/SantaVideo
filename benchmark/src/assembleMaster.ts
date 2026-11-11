/**
 * Assembles the master video: slow open + OmniHuman parts A/B/C + end card, with the original voice track
 * and a music bed that ducks under Santa's voice.
 *
 *   npm run bench:assemble                    # generic end card ("Merry Christmas!")
 *   npm run bench:assemble -- --name=Emma     # personalized end card ("Merry Christmas, Emma!")
 *
 * Prototype for the Phase 1 assembly worker. Output: 1920x1080, 25 fps, H.264 + AAC, -16 LUFS.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./config.js";
import { endCardFilter, validateDisplayName } from "./endCard.js";
import { probeDurationSeconds, runTool } from "./media.js";

const MASTERS = join(REPO_ROOT, "benchmark", "out", "masters");
const AUDIO = join(REPO_ROOT, "benchmark", "out", "audio", "master-en-v2");
const ASSETS = join(REPO_ROOT, "benchmark", "assets", "master");

const OPENING = join(MASTERS, "master-en-opening__kling-o3.mp4");
const PARTS = ["A", "B", "C"].map((id) => join(MASTERS, `master-en-part${id}__omnihuman.mp4`));
const PART_AUDIO = ["A", "B", "C"].map((id) => join(AUDIO, `part${id}.wav`));
const MUSIC = join(ASSETS, "music-bed-en.mp3");
const END_CARD_PLATE = join(ASSETS, "santa-master-still_1920x1080.png");
const END_CARD_SECONDS = 6;
/** Crossfade at shot seams. Every seam sits in silence (silent opening, mid-pause cuts), so we trim the overlap from audio. */
const SEAM_XFADE_SECONDS = 0.16; // 4 frames @ 25 fps
const END_CARD_XFADE_SECONDS = 0.6;
const FPS = 25;
const NORMALIZE_VIDEO = `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=${FPS},setsar=1,format=yuv420p`;

async function main(): Promise<void> {
  const nameArg = process.argv.find((a) => a.startsWith("--name="))?.slice("--name=".length);
  const name = nameArg ? validateDisplayName(nameArg) : undefined;

  for (const path of [OPENING, ...PARTS, ...PART_AUDIO, MUSIC, END_CARD_PLATE]) {
    if (!existsSync(path)) throw new Error(`Missing input: ${path}`);
  }

  const openingSeconds = await probeDurationSeconds(OPENING);
  const partSeconds = await Promise.all(PART_AUDIO.map(probeDurationSeconds));
  // Video segments in order and the crossfade into each following segment.
  const segmentSeconds = [openingSeconds, ...partSeconds, END_CARD_SECONDS];
  const xfades = [SEAM_XFADE_SECONDS, SEAM_XFADE_SECONDS, SEAM_XFADE_SECONDS, END_CARD_XFADE_SECONDS];
  const totalSeconds = segmentSeconds.reduce((a, b) => a + b, 0) - xfades.reduce((a, b) => a + b, 0);

  // Each xfade starts `xfade` seconds before the end of everything so far.
  const xfadeChain: string[] = [];
  let label = "v0";
  let elapsed = segmentSeconds[0]!;
  xfades.forEach((d, i) => {
    const out = i === xfades.length - 1 ? "v" : `x${i + 1}`;
    xfadeChain.push(`[${label}][v${i + 1}]xfade=transition=fade:duration=${d}:offset=${(elapsed - d).toFixed(3)}[${out}]`);
    elapsed += segmentSeconds[i + 1]! - d;
    label = out;
  });
  // Audio mirrors the video timeline: each segment loses its outgoing crossfade from its (silent) tail.
  const audioSeconds = segmentSeconds.map((s, i) => s - (xfades[i] ?? 0));

  const filter = [
    // Video: opening, the three talking parts trimmed to their exact audio length, then the end card.
    // The opening is rendered at 720p; a light unsharp after upscaling narrows the softness jump into part A.
    `[0:v]${NORMALIZE_VIDEO},unsharp=5:5:0.6:5:5:0.0[v0]`,
    ...partSeconds.map((s, i) => `[${i + 1}:v]trim=duration=${s},setpts=PTS-STARTPTS,${NORMALIZE_VIDEO}[v${i + 1}]`),
    `[4:v]${NORMALIZE_VIDEO},${endCardFilter(END_CARD_SECONDS, name)}[v4]`,
    ...xfadeChain,
    // Voice: silence under the opening, the three part tracks, silence under the end card (crossfades trimmed).
    `anullsrc=r=48000:cl=stereo,atrim=0:${audioSeconds[0]}[sil0]`,
    ...PART_AUDIO.map(
      (_, i) => `[${i + 5}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${audioSeconds[i + 1]},asetpts=PTS-STARTPTS[p${i}]`,
    ),
    `anullsrc=r=48000:cl=stereo,atrim=0:${audioSeconds[4]}[sil1]`,
    `[sil0][p0][p1][p2][sil1]concat=n=5:v=0:a=1,asplit=2[voice][key]`,
    // Music: full length, fades, ducked by the voice through a sidechain compressor.
    `[8:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${totalSeconds},asetpts=PTS-STARTPTS,` +
      `volume=0.55,afade=t=in:d=2,afade=t=out:st=${totalSeconds - 3}:d=3[music]`,
    `[music][key]sidechaincompress=threshold=0.03:ratio=10:attack=30:release=600[ducked]`,
    `[voice][ducked]amix=inputs=2:weights='1 1':normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`,
  ].join(";");

  const outPath = join(MASTERS, name ? `master-en_endcard-${name.toLowerCase().replace(/[^\p{L}]+/gu, "-")}.mp4` : "master-en.mp4");
  writeFileSync(join(MASTERS, "last-assembly-filter.txt"), filter);

  await runTool("ffmpeg", [
    "-y",
    "-i", OPENING,
    ...PARTS.flatMap((p) => ["-i", p]),
    "-loop", "1", "-t", String(END_CARD_SECONDS), "-i", END_CARD_PLATE,
    ...PART_AUDIO.flatMap((p) => ["-i", p]),
    "-i", MUSIC,
    "-filter_complex", filter,
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    outPath,
  ]);
  // Name slot position inside the talking section (from the audio manifest), shifted onto the final timeline.
  const audioManifest = JSON.parse(readFileSync(join(AUDIO, "master-en.manifest.json"), "utf8")) as {
    nameSlot: { start: number; end: number };
  };
  const talkingStart = audioSeconds[0]!;
  const finalManifest = {
    file: outPath,
    totalSeconds: +totalSeconds.toFixed(3),
    fps: FPS,
    talkingSectionStart: +talkingStart.toFixed(3),
    nameSlot: {
      start: +(talkingStart + audioManifest.nameSlot.start).toFixed(3),
      end: +(talkingStart + audioManifest.nameSlot.end).toFixed(3),
    },
  };
  writeFileSync(join(MASTERS, "master-en.final-manifest.json"), JSON.stringify(finalManifest, null, 2));
  console.log(`Assembled ${totalSeconds.toFixed(1)}s -> ${outPath}`);
  console.log(`Name slot in final video: ${finalManifest.nameSlot.start}s - ${finalManifest.nameSlot.end}s`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
