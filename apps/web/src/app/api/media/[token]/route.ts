import { isUrlToken } from "@santa/core";
import { storage } from "@/server/context";
import { findWatch } from "@/server/orders";
import { streamStoredFile } from "@/server/streamVideo";

export const runtime = "nodejs";

/** The finished video, behind the unguessable watch token. `?download=1` saves it with a generic file name. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isUrlToken(token)) return new Response("Not found", { status: 404 });
  const video = await findWatch(token);
  if (!video || video.status !== "ready" || !video.finalKey) return new Response("Not found", { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return streamStoredFile(storage(), video.finalKey, request, {
    contentType: "video/mp4",
    downloadName: download ? "video-from-santa.mp4" : undefined,
    cacheSeconds: 86_400,
  });
}
