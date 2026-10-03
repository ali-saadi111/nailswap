import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

export const BUCKETS = {
  publicMedia: "public-media",
  tryon: "tryon",
  privateDocs: "private-docs",
} as const;

export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Public URL for an object in the public bucket (CDN cached). */
export function publicMediaUrl(path: string | null | undefined) {
  if (!path) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${BUCKETS.publicMedia}/${path}`;
}

/** Signed URL for a private object. Default 1 hour. */
export async function signedUrl(bucket: Bucket, path: string, expiresInSec = 3600) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error || !data) throw new Error(`Failed to sign ${bucket}/${path}: ${error?.message}`);
  return data.signedUrl;
}

export async function signedUrls(bucket: Bucket, paths: string[], expiresInSec = 3600) {
  if (!paths.length) return [];
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrls(paths, expiresInSec);
  if (error || !data) throw new Error(`Failed to sign urls: ${error?.message}`);
  return data.map((d) => d.signedUrl ?? "");
}

export async function uploadObject(
  bucket: Bucket,
  path: string,
  body: Buffer | Blob,
  contentType: string,
  upsert = false,
) {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert, cacheControl: "31536000" });
  if (error) throw new Error(`Upload failed ${bucket}/${path}: ${error.message}`);
  return path;
}

export async function removeObjects(bucket: Bucket, paths: string[]) {
  if (!paths.length) return;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).remove(paths);
  if (error) throw new Error(`Remove failed: ${error.message}`);
}

export async function downloadObject(bucket: Bucket, path: string): Promise<Buffer> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Download failed ${bucket}/${path}: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

/** Fetches a remote (provider) image and stores it in our bucket. */
export async function importRemoteImage(
  url: string,
  bucket: Bucket,
  path: string,
  contentType = "image/jpeg",
) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await uploadObject(bucket, path, buf, res.headers.get("content-type") ?? contentType, true);
  return path;
}
