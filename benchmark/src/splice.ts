/**
 * Name-splice prototype.
 *
 *   npm run bench:splice -- fit    <greeting.mp3> <slotSeconds> <out.wav>
 *   npm run bench:splice -- splice <master.mp4> <clip.mp4> <slotStartSeconds> <out.mp4>
 *
 * `fit` makes greeting audio exactly slot-length before lip-sync.
 * `splice` replaces the master's name slot with the lip-synced clip. Video frames
 * around the cut are untouched master frames; audio gets short fades at both joins
 * (the master script places a natural pause before and after the greeting).
 */
import { probeDurationSeconds, probeVideo, runTool } from "./media.js";
import { fitGreetingToSlot } from "./slotFit.js";

const JOIN_FADE_SECONDS = 0.04;
const SAMPLE_RATE = 48_000;

export async function fitGreetingAudio(inputPath: string, slotSeconds: number, outputPath: string): Promise<void> {
  const greetingSeconds = await probeDurationSeconds(inputPath);
  const fit = fitGreetingToSlot(greetingSeconds, slotSeconds);
  if (fit.action === "reject") throw new Error(`Greeting rejected for slot: ${fit.reason}`);

  const tempoFilter = fit.action === "speedUp" ? `atempo=${fit.tempo},` : "";
  // apad + atrim guarantees exact slot length regardless of rounding in atempo.
  await runTool("ffmpeg", [
    "-y", "-i", inputPath,
    "-af", `${tempoFilter}aresample=${SAMPLE_RATE},apad,atrim=0:${slotSeconds}`,
    "-ac", "1", outputPath,
  ]);
}

export async function spliceNameClip(masterPath: string, clipPath: string, slotStart: number, outputPath: string): Promise<void> {
  const [master, clipSeconds] = await Promise.all([probeVideo(masterPath), probeDurationSeconds(clipPath)]);
  const slotEnd = slotStart + clipSeconds;
  const f = JOIN_FADE_SECONDS;
  const norm = `scale=${master.width}:${master.height},fps=${master.fps},format=yuv420p,setsar=1`;
  const aNorm = `aresample=${SAMPLE_RATE},aformat=channel_layouts=stereo`;

  const filter = [
    `[0:v]trim=0:${slotStart},setpts=PTS-STARTPTS,${norm}[v0]`,
    `[1:v]trim=0:${clipSeconds},setpts=PTS-STARTPTS,${norm}[v1]`,
    `[0:v]trim=start=${slotEnd},setpts=PTS-STARTPTS,${norm}[v2]`,
    `[0:a]atrim=0:${slotStart},asetpts=PTS-STARTPTS,${aNorm},afade=t=out:st=${slotStart - f}:d=${f}[a0]`,
    `[1:a]atrim=0:${clipSeconds},asetpts=PTS-STARTPTS,${aNorm},afade=t=in:d=${f},afade=t=out:st=${clipSeconds - f}:d=${f}[a1]`,
    `[0:a]atrim=start=${slotEnd},asetpts=PTS-STARTPTS,${aNorm},afade=t=in:d=${f}[a2]`,
    `[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]`,
  ].join(";");

  await runTool("ffmpeg", [
    "-y", "-i", masterPath, "-i", clipPath,
    "-filter_complex", filter, "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart", outputPath,
  ]);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "fit" && args.length === 3) {
    await fitGreetingAudio(args[0]!, Number(args[1]), args[2]!);
  } else if (command === "splice" && args.length === 4) {
    await spliceNameClip(args[0]!, args[1]!, Number(args[2]), args[3]!);
  } else {
    throw new Error("Usage: bench:splice -- fit <greeting> <slotSeconds> <out.wav> | splice <master> <clip> <slotStart> <out.mp4>");
  }
  console.log("Done.");
}

if (process.argv[1]?.endsWith("splice.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
