import { storage } from "@/server/context";
import { streamStoredFile } from "@/server/streamVideo";

export const runtime = "nodejs";

/** Landing-page sample: samples/en.mp4 and its poster samples/en.jpg (made with a public name). */
const FILES: Record<string, { key: string; type: string }> = {
  "en.mp4": { key: "samples/en.mp4", type: "video/mp4" },
  "en.jpg": { key: "samples/en.jpg", type: "image/jpeg" },
};

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const entry = FILES[file];
  if (!entry) return new Response("Not found", { status: 404 });
  return streamStoredFile(storage(), entry.key, request, { contentType: entry.type, cacheSeconds: 86_400 });
}
