import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Runs an ffmpeg-family binary with argument arrays (never a shell string) and surfaces stderr on failure. */
export async function runTool(binary: "ffmpeg" | "ffprobe", args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(binary, args, { maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    throw new Error(`${binary} failed: ${stderr.split("\n").slice(-8).join("\n")}`);
  }
}

export async function probeDurationSeconds(path: string): Promise<number> {
  const out = await runTool("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]);
  const seconds = Number.parseFloat(out.trim());
  if (!Number.isFinite(seconds)) throw new Error(`Could not read duration of ${path}`);
  return seconds;
}

export interface VideoInfo {
  width: number;
  height: number;
  fps: number;
}

export async function probeVideo(path: string): Promise<VideoInfo> {
  const out = await runTool("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_frame_rate", "-of", "json", path,
  ]);
  const stream = (JSON.parse(out) as { streams?: Array<{ width: number; height: number; r_frame_rate: string }> }).streams?.[0];
  if (!stream) throw new Error(`No video stream in ${path}`);
  const [num, den] = stream.r_frame_rate.split("/").map(Number);
  return { width: stream.width, height: stream.height, fps: num! / (den || 1) };
}
