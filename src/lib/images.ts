import sharp from "sharp";
import type { DocKind } from "@/lib/documents";

/** Immigration limits (ICD): the face photo ≤ 100 KB, every other file ≤ 1 MB, JPEG or PDF only. */
export const MAX_KB: Record<string, number> = { photo: 100 };
export const maxBytesFor = (kind: DocKind | string) => (MAX_KB[kind] ?? 1024) * 1024;

export type Normalized = { ok: true; bytes: Buffer; mime: "image/jpeg" | "application/pdf"; width?: number; height?: number } | { ok: false; error: string };

/**
 * Turns whatever the traveler uploaded (phone photo, PNG, WebP, big scan, PDF) into something Immigration accepts:
 * rotated upright, metadata (GPS, device) removed, JPEG, within the size limit. Quality is lowered step by step, the picture is never rejected for being "too big".
 */
export async function normalizeUpload(input: Uint8Array, kind: DocKind | string): Promise<Normalized> {
  const limit = maxBytesFor(kind);
  const buf = Buffer.from(input);
  if (buf.length === 0) return { ok: false, error: "err_file_missing" };
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") {
    if (kind === "photo") return { ok: false, error: "err_photo_must_be_image" };
    return buf.length <= limit ? { ok: true, bytes: buf, mime: "application/pdf" } : { ok: false, error: "err_file_big" };
  }
  let meta;
  try { meta = await sharp(buf, { failOn: "error" }).metadata(); } catch { return { ok: false, error: "err_file_type" }; }
  if (!meta.format || !["jpeg", "png", "webp", "gif", "tiff"].includes(meta.format)) return { ok: false, error: "err_file_type" };
  if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 200) return { ok: false, error: "err_image_small" };
  const maxSide = kind === "photo" ? 800 : 2400;
  for (const [side, quality] of [[maxSide, 85], [maxSide, 70], [Math.round(maxSide * 0.75), 60], [Math.round(maxSide * 0.55), 50], [Math.round(maxSide * 0.4), 40], [Math.round(maxSide * 0.3), 32]] as const) {
    const out = await sharp(buf).rotate().flatten({ background: { r: 255, g: 255, b: 255 } }).resize({ width: side, height: side, fit: "inside", withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    if (out.data.length <= limit) return { ok: true, bytes: out.data, mime: "image/jpeg", width: out.info.width, height: out.info.height };
  }
  return { ok: false, error: "err_file_big" };
}
