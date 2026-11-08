import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { sniffImage } from "@/lib/brand/brand";
import { NEWS_IMG_RE, NEWS_IMG_PREFIX } from "./rich";

// Pictures for news. They go in the existing private "brand-assets" bucket under news/, are checked by their real bytes, resized and re-encoded (which also drops
// camera data such as the GPS position), and are served only through /news-img/<name> with a random name. No database change is needed.
const BUCKET = "brand-assets", FOLDER = "news";
export const MAX_NEWS_IMAGE_BYTES = 6 * 1024 * 1024;
export const NEWS_IMAGE_MAX_SIDE = 1600;

export async function saveNewsImage(bytes: Uint8Array): Promise<{ ok: true; name: string; url: string } | { ok: false; error: string }> {
  if (bytes.length === 0) return { ok: false, error: "err_file_missing" };
  if (bytes.length > MAX_NEWS_IMAGE_BYTES) return { ok: false, error: "err_file_big" };
  if (!sniffImage(bytes)) return { ok: false, error: "err_file_type" };                  // png, jpeg or webp by content; SVG and the rest are refused
  let out: Buffer;
  try { out = await sharp(bytes, { limitInputPixels: 80_000_000 }).rotate().resize({ width: NEWS_IMAGE_MAX_SIDE, height: NEWS_IMAGE_MAX_SIDE, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(); }
  catch { return { ok: false, error: "err_file_type" }; }
  const name = `${randomBytes(12).toString("hex")}.webp`;
  const up = await createAdminClient().storage.from(BUCKET).upload(`${FOLDER}/${name}`, out, { contentType: "image/webp", upsert: false });
  if (up.error) { console.error("[news] image upload failed", up.error.message); return { ok: false, error: "err_generic" }; }
  return { ok: true, name, url: `${NEWS_IMG_PREFIX}${name}` };
}

export async function readNewsImage(name: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!NEWS_IMG_RE.test(name)) return null;
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(`${FOLDER}/${name}`);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), mime: name.endsWith(".png") ? "image/png" : name.endsWith(".jpg") ? "image/jpeg" : "image/webp" };
}

/** Removes picture files that no content item uses any more (called after an item is deleted). Failures are logged and never block the caller. */
export async function removeUnusedNewsImages(names: string[]): Promise<number> {
  if (names.length === 0) return 0;
  try {
    const db = createAdminClient();
    const { data } = await db.from("content_items").select("body").limit(2000);
    const used = JSON.stringify(data ?? []);
    const gone = names.filter((n) => NEWS_IMG_RE.test(n) && !used.includes(n));
    if (gone.length === 0) return 0;
    const rm = await db.storage.from(BUCKET).remove(gone.map((n) => `${FOLDER}/${n}`));
    return rm.error ? 0 : gone.length;
  } catch (e) { console.error("[news] cleanup failed", (e as Error).message); return 0; }
}
