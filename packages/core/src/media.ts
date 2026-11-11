import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { findRepoRoot } from "./repoRoot";

const execFileAsync = promisify(execFile);

/**
 * Runs ffmpeg/ffprobe with an argument array (never a shell string). On failure only the last stderr lines
 * are surfaced; callers must not log them verbatim if the filtergraph contains a name.
 */
export async function runTool(binary: "ffmpeg" | "ffprobe", args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(binary, args, { maxBuffer: 32 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    throw new Error(`${binary} failed: ${stderr.split("\n").slice(-6).join("\n")}`);
  }
}

export async function probeDurationSeconds(path: string): Promise<number> {
  const out = await runTool("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]);
  const seconds = Number.parseFloat(out.trim());
  if (!Number.isFinite(seconds)) throw new Error("Could not read media duration");
  return seconds;
}

/**
 * End-card font: Great Vibes (SIL OFL 1.1, licence in assets/fonts/GreatVibes-OFL.txt), shipped in the repo
 * so Windows dev and the Linux server render identically. END_CARD_FONT overrides it.
 */
export function endCardFont(): string {
  return process.env.END_CARD_FONT || join(findRepoRoot(), "assets", "fonts", "GreatVibes-Regular.ttf");
}

/**
 * Bump when the end-card look changes (font, layout, colours). It is part of the final-video and preview
 * cache keys, so cached files made with the old look are re-rendered instead of reused.
 */
export const END_CARD_STYLE = "greatvibes-1";

/** Path form ffmpeg's filter parser accepts (drive colon escaped). */
function filterPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/:/g, "\\:");
}

/** Escapes text for drawtext inside a filtergraph (no shell involved). Names are validated upstream too. */
export function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/'/g, "\u2019")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/%/g, "\\%")
    .replace(/;/g, "\\;");
}

export interface EndCardText {
  title: string;
  signature: string;
}

/** Blurred plate + fading title and signature. `seconds` = card length (fade out in the last second). */
export function endCardFilter(seconds: number, text: EndCardText): string {
  const font = filterPath(endCardFont());
  const fadeIn = (start: number) => `alpha='if(lt(t,${start}),0,min(1,(t-${start})/0.8))'`;
  return (
    `boxblur=18:2,eq=brightness=-0.12,` +
    `drawtext=fontfile='${font}':text='${escapeDrawtext(text.title)}':fontsize=120:fontcolor=white:x=(w-text_w)/2:y=(h/2)-110:shadowcolor=black@0.5:shadowx=3:shadowy=3:${fadeIn(0.4)},` +
    `drawtext=fontfile='${font}':text='${escapeDrawtext(text.signature)}':fontsize=72:fontcolor=0xF5E6C8:x=(w-text_w)/2:y=(h/2)+40:shadowcolor=black@0.5:shadowx=2:shadowy=2:${fadeIn(1.4)},` +
    `fade=t=in:st=0:d=0.6,fade=t=out:st=${seconds - 1}:d=1`
  );
}

/** Still preview: the end card with the name, plus a diagonal-ish repeated watermark. */
export function previewImageFilter(text: EndCardText & { watermark: string }): string {
  const font = filterPath(endCardFont());
  const mark = escapeDrawtext(text.watermark);
  const watermarkFont = filterPath(join(findRepoRoot(), "assets", "fonts", "PlayfairDisplay-Italic.ttf"));
  const marks = [
    [0.12, 0.18],
    [0.62, 0.3],
    [0.3, 0.72],
    [0.78, 0.82],
  ]
    .map(
      ([x, y]) =>
        // Script capitals read badly ("PREVJEW"), so the watermark uses a serif italic.
        `drawtext=fontfile='${watermarkFont}':text='${mark}':fontsize=64:fontcolor=white@0.2:x=w*${x}:y=h*${y}`,
    )
    .join(",");
  return (
    `scale=1280:720,boxblur=14:2,eq=brightness=-0.12,` +
    `drawtext=fontfile='${font}':text='${escapeDrawtext(text.title)}':fontsize=84:fontcolor=white:x=(w-text_w)/2:y=(h/2)-80:shadowcolor=black@0.5:shadowx=3:shadowy=3,` +
    `drawtext=fontfile='${font}':text='${escapeDrawtext(text.signature)}':fontsize=50:fontcolor=0xF5E6C8:x=(w-text_w)/2:y=(h/2)+30:shadowcolor=black@0.5:shadowx=2:shadowy=2,` +
    marks
  );
}
