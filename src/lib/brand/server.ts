import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting, putSetting } from "@/lib/settings";
import { brandToColumn, checkFavicon, checkLogo, parseBrand, type Brand, type BrandImage } from "./brand";

const BUCKET = "brand-assets";

export async function loadBrand(): Promise<Brand> {
  return parseBrand(await getSetting<unknown>("brand", {}));
}

export type BrandKind = "logo" | "favicon";

/**
 * Saves a new brand image: upload under a NEW path (version in the name, never overwrite) → point the setting at it →
 * only then delete the old file. If pointing fails, the new file is removed and the old image keeps working.
 */
export async function saveBrandImage(kind: BrandKind, bytes: Uint8Array, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const check = kind === "logo" ? checkLogo(bytes) : checkFavicon(bytes);
  if (!check.ok) return check;

  const db = createAdminClient();
  const brand = await loadBrand();
  const version = Date.now();
  const image: BrandImage = { mime: check.sniffed.mime, ext: check.sniffed.ext, version };
  const path = `${kind}-${version}.${image.ext}`;

  const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: image.mime, upsert: false });
  if (up.error) {
    console.error("[brand] upload failed", up.error.message);
    return { ok: false, error: "err_generic" };
  }
  const old = brand[kind];
  const next: Brand = { ...brand, [kind]: image };
  if (!(await putSetting("brand", brandToColumn(next), userId))) {
    await db.storage.from(BUCKET).remove([path]);
    return { ok: false, error: "err_generic" };
  }
  if (old) await db.storage.from(BUCKET).remove([`${kind}-${old.version}.${old.ext}`]);
  return { ok: true };
}

export async function resetBrandImage(kind: BrandKind, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const brand = await loadBrand();
  const old = brand[kind];
  const next: Brand = { ...brand, [kind]: null };
  if (!(await putSetting("brand", brandToColumn(next), userId))) return { ok: false, error: "err_generic" };
  if (old) await createAdminClient().storage.from(BUCKET).remove([`${kind}-${old.version}.${old.ext}`]);
  return { ok: true };
}

export async function saveBrandName(name: string, userId: string): Promise<boolean> {
  const brand = await loadBrand();
  return putSetting("brand", brandToColumn({ ...brand, name: name.trim() }), userId);
}

export async function readBrandFile(kind: BrandKind, image: BrandImage): Promise<Uint8Array | null> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(`${kind}-${image.version}.${image.ext}`);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
