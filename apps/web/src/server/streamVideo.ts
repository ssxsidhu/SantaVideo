import "server-only";
import { Readable } from "node:stream";
import type { ObjectStorage } from "@santa/core";

/**
 * Serves a stored file. With R2 the browser is redirected to a short-lived signed URL (bytes never pass
 * through our server); on local disk the file is streamed with HTTP Range support so seeking and iOS work.
 */
export async function streamStoredFile(
  store: ObjectStorage,
  key: string,
  request: Request,
  options: { contentType: string; downloadName?: string; cacheSeconds?: number },
): Promise<Response> {
  const signed = await store.signedUrl(key, { expiresInSeconds: 3600, downloadName: options.downloadName });
  if (signed) {
    return new Response(null, { status: 302, headers: { Location: signed, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }

  if (!(await store.exists(key))) return new Response("Not found", { status: 404 });
  const size = await store.size(key);
  const headers = new Headers({
    "Content-Type": options.contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": `private, max-age=${options.cacheSeconds ?? 3600}`,
    "X-Robots-Tag": "noindex",
  });
  if (options.downloadName) headers.set("Content-Disposition", `attachment; filename="${options.downloadName}"`);

  const range = request.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && (match[1] || match[2])) {
    let start = match[1] ? Number(match[1]) : size - Number(match[2]);
    let end = match[1] && match[2] ? Number(match[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(Readable.toWeb(await store.read(key, { start, end })) as ReadableStream, { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(await store.read(key)) as ReadableStream, { status: 200, headers });
}
