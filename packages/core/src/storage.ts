import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { AwsClient } from "aws4fetch";

/**
 * Object storage for clips, videos and previews: Cloudflare R2 when R2_* is set, the local disk otherwise.
 * Keys are hashes/UUIDs only, never names, emails or order IDs.
 */
export interface ObjectStorage {
  readonly kind: "local" | "r2";
  put(key: string, data: Buffer): Promise<void>;
  putFile(key: string, sourcePath: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  size(key: string): Promise<number>;
  /** Copies an object to a local file (ffmpeg inputs). */
  getToFile(key: string, destPath: string): Promise<void>;
  /** Byte stream, optionally a range (inclusive end) for video seeking. */
  read(key: string, range?: { start: number; end: number }): Promise<Readable>;
  /**
   * Short-lived direct URL the browser can fetch (R2 presigned GET), or undefined when the app must
   * stream the bytes itself (local disk).
   */
  signedUrl(key: string, options: { expiresInSeconds: number; downloadName?: string }): Promise<string | undefined>;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]*$/;

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  wav: "audio/wav",
  jpg: "image/jpeg",
  png: "image/png",
};

function contentTypeFor(key: string): string {
  return CONTENT_TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream";
}

export class LocalDiskStorage implements ObjectStorage {
  readonly kind = "local" as const;

  constructor(private readonly root: string) {}

  private path(key: string): string {
    assertKey(key);
    const full = resolve(this.root, key);
    if (!full.startsWith(resolve(this.root) + sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, path); // atomic: readers never see half a file
  }

  async putFile(key: string, sourcePath: string): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    await copyFile(sourcePath, tmp);
    await rename(tmp, path);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.path(key));
      return true;
    } catch {
      return false;
    }
  }

  async size(key: string): Promise<number> {
    return (await stat(this.path(key))).size;
  }

  async getToFile(key: string, destPath: string): Promise<void> {
    await copyFile(this.path(key), destPath);
  }

  async read(key: string, range?: { start: number; end: number }): Promise<Readable> {
    return createReadStream(this.path(key), range);
  }

  async signedUrl(): Promise<undefined> {
    return undefined;
  }
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/** R2 over its S3 API, signed with aws4fetch (no AWS SDK). */
export class R2Storage implements ObjectStorage {
  readonly kind = "r2" as const;
  private readonly client: AwsClient;
  private readonly base: string;

  constructor(config: R2Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: "s3",
      region: "auto",
    });
    this.base = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`;
  }

  private url(key: string): string {
    assertKey(key);
    return `${this.base}/${key}`;
  }

  private async request(key: string, init: RequestInit & { allow404?: boolean } = {}): Promise<Response> {
    const { allow404, ...rest } = init;
    const response = await this.client.fetch(this.url(key), rest);
    if (!response.ok && !(allow404 && response.status === 404)) {
      // Status only: keys are hashes, but keep vendor error bodies out of our logs.
      throw new Error(`R2 ${rest.method ?? "GET"} failed (HTTP ${response.status})`);
    }
    return response;
  }

  async put(key: string, data: Buffer): Promise<void> {
    await this.request(key, {
      method: "PUT",
      body: new Uint8Array(data),
      headers: { "Content-Type": contentTypeFor(key), "Content-Length": String(data.length) },
    });
  }

  async putFile(key: string, sourcePath: string): Promise<void> {
    // Files are tens of MB at most; a single PUT keeps it simple (R2 single-PUT limit is far higher).
    await this.put(key, await readFile(sourcePath));
  }

  async exists(key: string): Promise<boolean> {
    const response = await this.request(key, { method: "HEAD", allow404: true });
    return response.status !== 404;
  }

  async size(key: string): Promise<number> {
    const response = await this.request(key, { method: "HEAD" });
    return Number(response.headers.get("content-length") ?? 0);
  }

  async getToFile(key: string, destPath: string): Promise<void> {
    const response = await this.request(key);
    await writeFile(destPath, Buffer.from(await response.arrayBuffer()));
  }

  async read(key: string, range?: { start: number; end: number }): Promise<Readable> {
    const response = await this.request(key, range ? { headers: { Range: `bytes=${range.start}-${range.end}` } } : {});
    if (!response.body) throw new Error("R2 returned an empty body");
    return Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
  }

  async signedUrl(key: string, options: { expiresInSeconds: number; downloadName?: string }): Promise<string> {
    const url = new URL(this.url(key));
    url.searchParams.set("X-Amz-Expires", String(Math.max(60, Math.min(options.expiresInSeconds, 7 * 24 * 3600))));
    if (options.downloadName) {
      url.searchParams.set("response-content-disposition", `attachment; filename="${options.downloadName}"`);
    }
    const signed = await this.client.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
    return signed.url;
  }
}

export function r2ConfigFromEnv(): R2Config | undefined {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  const values = [R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET];
  if (values.every((v) => !v)) return undefined;
  if (values.some((v) => !v)) throw new Error("R2 is partly configured: set all of R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET");
  return { accountId: R2_ACCOUNT_ID!, accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY!, bucket: R2_BUCKET! };
}

let shared: ObjectStorage | undefined;

/** R2 when configured, otherwise the local disk under STORAGE_DIR (relative to the repo root). */
export function getStorage(repoRoot: string): ObjectStorage {
  if (!shared) {
    const r2 = r2ConfigFromEnv();
    shared = r2 ? new R2Storage(r2) : new LocalDiskStorage(resolve(repoRoot, process.env.STORAGE_DIR || ".data/storage"));
  }
  return shared;
}

export const storageKeys = {
  nameClip: (cacheKey: string) => `clips/${cacheKey}.mp4`,
  nameAudio: (cacheKey: string) => `clips/${cacheKey}.wav`,
  finalVideo: (cacheKey: string) => `videos/${cacheKey}.mp4`,
  preview: (cacheKey: string) => `previews/${cacheKey}.jpg`,
} as const;
