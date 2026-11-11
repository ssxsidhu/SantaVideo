import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalDiskStorage, R2Storage, r2ConfigFromEnv } from "./storage";

describe("LocalDiskStorage", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "storage-test-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips bytes, sizes, ranges and file copies", async () => {
    const store = new LocalDiskStorage(join(dir, "root"));
    await store.put("videos/abc.mp4", Buffer.from("0123456789"));
    expect(await store.exists("videos/abc.mp4")).toBe(true);
    expect(await store.size("videos/abc.mp4")).toBe(10);
    const chunks: Buffer[] = [];
    for await (const c of await store.read("videos/abc.mp4", { start: 2, end: 4 })) chunks.push(c as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe("234");
    const out = join(dir, "copy.mp4");
    await store.getToFile("videos/abc.mp4", out);
    expect((await readFile(out)).toString()).toBe("0123456789");
    expect(await store.signedUrl()).toBeUndefined();
  });

  it("rejects keys that could escape the root or carry odd characters", async () => {
    const store = new LocalDiskStorage(join(dir, "root"));
    for (const key of ["../x.mp4", "videos/../../x", "/abs.mp4", "Emma.mp4", "a b.mp4"]) {
      await expect(store.put(key, Buffer.from("x"))).rejects.toThrow("Invalid storage key");
    }
    const src = join(dir, "src.wav");
    await writeFile(src, "x");
    await expect(store.putFile("clips/../x.wav", src)).rejects.toThrow();
  });
});

describe("R2Storage.signedUrl", () => {
  const store = new R2Storage({ accountId: "acc123", accessKeyId: "AKIDTEST", secretAccessKey: "secret", bucket: "media" });

  it("presigns a GET on the bucket path with an expiry and signature", async () => {
    const url = new URL(await store.signedUrl("videos/abc.mp4", { expiresInSeconds: 3600 }));
    expect(url.host).toBe("acc123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/media/videos/abc.mp4");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-Credential")).toContain("AKIDTEST/");
  });

  it("adds a generic download name and clamps the expiry", async () => {
    const url = new URL(await store.signedUrl("videos/abc.mp4", { expiresInSeconds: 10 * 24 * 3600, downloadName: "video-from-santa.mp4" }));
    expect(url.searchParams.get("response-content-disposition")).toBe('attachment; filename="video-from-santa.mp4"');
    expect(url.searchParams.get("X-Amz-Expires")).toBe(String(7 * 24 * 3600));
  });

  it("refuses unsafe keys before signing", async () => {
    await expect(store.signedUrl("../secrets", { expiresInSeconds: 60 })).rejects.toThrow("Invalid storage key");
  });
});

describe("r2ConfigFromEnv", () => {
  const keys = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("is off when nothing is set and refuses a half-configured R2", () => {
    for (const k of keys) delete process.env[k];
    expect(r2ConfigFromEnv()).toBeUndefined();
    process.env.R2_BUCKET = "media";
    expect(() => r2ConfigFromEnv()).toThrow("partly configured");
  });
});
