import { supabase } from "@/integrations/supabase/client";

/** Shared signed-URL cache so the same media/avatar is only signed once per hour. */
const cache = new Map<string, { url: string; expires: number }>();
const inflight = new Map<string, Promise<string | null>>();

export async function signedUrl(
  bucket: "chat-media" | "avatars" | "talent",
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const key = `${bucket}:${path}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60)
    .then(({ data }) => {
      const url = data?.signedUrl ?? null;
      if (url) cache.set(key, { url, expires: Date.now() + 55 * 60 * 1000 });
      inflight.delete(key);
      return url;
    })
    .catch(() => {
      inflight.delete(key);
      return null;
    });

  inflight.set(key, p);
  return p;
}

/**
 * Zero-rated-friendly image compression. Shrinks to a 1280px long edge and
 * re-encodes as JPEG so a 4 MB phone photo leaves the device around 120–180 KB.
 */
export async function compressImage(file: File, maxEdge = 1280, quality = 0.72): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;

const DATA_SAVER_KEY = "wanda.dataSaver";

export function getDataSaver(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DATA_SAVER_KEY) === "1";
}

export function setDataSaver(on: boolean) {
  localStorage.setItem(DATA_SAVER_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event("wanda-data-saver"));
}
