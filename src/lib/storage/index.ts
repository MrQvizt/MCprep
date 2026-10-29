import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export interface StoredObject {
  key: string;
  url: string;
}

export interface StorageDriver {
  readonly name: "local" | "s3";
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]*$/;

export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}

// ── Local filesystem (development / single-server hosting) ────────────────
class LocalStorage implements StorageDriver {
  readonly name = "local" as const;
  constructor(private readonly root: string) {}

  resolve(key: string) {
    assertSafeKey(key);
    const root = path.resolve(this.root);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Path traversal blocked");
    return full;
  }

  async put(key: string, body: Buffer): Promise<StoredObject> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    return { key, url: this.publicUrl(key) };
  }

  async delete(key: string) {
    try {
      await unlink(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  publicUrl(key: string) {
    return `/media/${key}`;
  }
}

// ── S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, …) ─────────
class S3Storage implements StorageDriver {
  readonly name = "s3" as const;
  private clientPromise: Promise<import("@aws-sdk/client-s3").S3Client> | null = null;

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = import("@aws-sdk/client-s3").then(({ S3Client }) => {
        const e = env();
        return new S3Client({
          region: e.S3_REGION || "auto",
          endpoint: e.S3_ENDPOINT,
          forcePathStyle: e.S3_FORCE_PATH_STYLE === "true",
          credentials:
            e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY
              ? { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY }
              : undefined,
        });
      });
    }
    return this.clientPromise;
  }

  private bucket() {
    const bucket = env().S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET is not configured");
    return bucket;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    assertSafeKey(key);
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { key, url: this.publicUrl(key) };
  }

  async delete(key: string) {
    assertSafeKey(key);
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }));
  }

  publicUrl(key: string) {
    const base = env().MEDIA_PUBLIC_BASE_URL;
    if (!base) throw new Error("MEDIA_PUBLIC_BASE_URL is required for S3 storage");
    return `${base.replace(/\/$/, "")}/${key}`;
  }
}

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (!driver) {
    const e = env();
    driver = e.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage(e.UPLOAD_DIR);
  }
  return driver;
}

export function localStorageDriver(): LocalStorage | null {
  const d = storage();
  return d instanceof LocalStorage ? d : null;
}
