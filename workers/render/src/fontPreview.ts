/** Renders the end card in each candidate font (EN + FR line) into one 2x2 comparison sheet. */
import { join } from "node:path";
import { derivedFiles, escapeDrawtext, findRepoRoot, getMaster, runTool } from "@santa/core";

const root = findRepoRoot();
const plate = derivedFiles.plate(getMaster("en", root));
const dir = join(root, "assets", "fonts", "_candidates");
const out = process.argv[2];
if (!out) throw new Error("Usage: tsx src/fontPreview.ts <out.jpg>");

const fonts = [
  ["Great Vibes", "GreatVibes-Regular.ttf", 1.0],
  ["Pinyon Script", "PinyonScript-Regular.ttf", 0.95],
  ["Cormorant Garamond Italic", "CormorantGaramond-Italic.ttf", 0.9],
  ["Playfair Display Italic", "PlayfairDisplay-Italic.ttf", 0.8],
] as const;

const filterPath = (p: string) => p.split("\\").join("/").split(":").join("\\:");
const label = filterPath("C:/Windows/Fonts/arial.ttf");
const tiles: string[] = [];

for (const [name, file, scale] of fonts) {
  const tile = join(dir, `tile-${file}.png`);
  const f = filterPath(join(dir, file));
  const text = (t: string, size: number, color: string, y: string) =>
    `drawtext=fontfile='${f}':text='${escapeDrawtext(t)}':fontsize=${Math.round(size * scale)}:fontcolor=${color}:x=(w-text_w)/2:y=${y}:shadowcolor=black@0.5:shadowx=2:shadowy=2`;
  const vf = [
    "scale=960:540,boxblur=9:2,eq=brightness=-0.12",
    text("Merry Christmas, Emma!", 64, "white", "(h/2)-90"),
    text("Love, Santa", 40, "0xF5E6C8", "(h/2)-5"),
    text("Joyeux Noël, Zoë et François!", 44, "white@0.85", "(h/2)+70"),
    `drawtext=fontfile='${label}':text='${escapeDrawtext(name)}':fontsize=22:fontcolor=0xE2B866:x=16:y=14:box=1:boxcolor=black@0.5:boxborderw=6`,
  ].join(",");
  await runTool("ffmpeg", ["-v", "error", "-y", "-i", plate, "-vf", vf, "-frames:v", "1", tile]);
  tiles.push(tile);
}

await runTool("ffmpeg", [
  "-v", "error", "-y",
  ...tiles.flatMap((t) => ["-i", t]),
  "-filter_complex", "[0][1][2][3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0",
  "-q:v", "3",
  out,
]);
console.log(out);
