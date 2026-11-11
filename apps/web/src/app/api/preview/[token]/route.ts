import { isUrlToken } from "@santa/core";
import { storage } from "@/server/context";
import { findPreview } from "@/server/orders";
import { previewImageKey } from "@/server/preview";
import { streamStoredFile } from "@/server/streamVideo";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isUrlToken(token)) return new Response("Not found", { status: 404 });
  const order = await findPreview(token);
  if (!order) return new Response("Not found", { status: 404 });
  try {
    const key = await previewImageKey({ childName: order.childName, language: order.language, locale: order.locale });
    return streamStoredFile(storage(), key, request, { contentType: "image/jpeg", cacheSeconds: 600 });
  } catch (error) {
    console.error("preview render failed:", error instanceof Error ? error.message.split("\n")[0] : "unknown");
    return new Response("Preview unavailable", { status: 500 });
  }
}
