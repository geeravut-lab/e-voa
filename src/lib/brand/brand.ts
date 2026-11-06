// Pure helpers for the brand settings (no server imports, so they can be unit-tested and used anywhere).

export const DEFAULT_BRAND_NAME = "ThaiPass e-VOA";
export const MAX_LOGO_BYTES = 1024 * 1024;
export const MAX_FAVICON_BYTES = 512 * 1024;
export const FAVICON_MIN = 192;
export const FAVICON_MAX = 1024;

export type BrandImage = { mime: string; version: number; ext: string };
export type Brand = { name: string; logo: BrandImage | null; favicon: BrandImage | null };
export const DEFAULT_BRAND: Brand = { name: DEFAULT_BRAND_NAME, logo: null, favicon: null };

const isImage = (v: unknown): v is BrandImage =>
  !!v && typeof v === "object" &&
  typeof (v as BrandImage).mime === "string" &&
  typeof (v as BrandImage).ext === "string" &&
  Number.isFinite((v as BrandImage).version);

/** Lenient: a missing or malformed field falls back to the default, so a damaged row never breaks every page. */
export function parseBrand(raw: unknown): Brand {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = typeof r.name === "string" && validBrandName(r.name) ? r.name.trim() : DEFAULT_BRAND_NAME;
  return { name, logo: isImage(r.logo) ? r.logo : null, favicon: isImage(r.favicon) ? r.favicon : null };
}

/** Stores only what differs from the default; `{}` means "use the built-in name and images". */
export function brandToColumn(b: Brand): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (b.name !== DEFAULT_BRAND_NAME) out.name = b.name;
  if (b.logo) out.logo = b.logo;
  if (b.favicon) out.favicon = b.favicon;
  return out;
}

/** 1–40 characters, one line, no < > or control characters (the name ends up in <title>, the manifest and messages). */
export function validBrandName(name: string): boolean {
  const n = name.trim();
  if (n.length < 1 || n.length > 40) return false;
  // eslint-disable-next-line no-control-regex
  return !/[<>\u0000-\u001f\u007f]/.test(n);
}

/** Replaces the default name with the admin-chosen one in a single pass (so a new name that contains the old one is not doubled). */
export function applyBrandName(text: string, name: string): string {
  if (name === DEFAULT_BRAND_NAME) return text;
  return text.replace(/ThaiPass e-VOA/g, () => name);
}

// ---- reading real image bytes (never trust the file extension or the browser's mime type)
export type Sniffed = { mime: "image/png" | "image/jpeg" | "image/webp"; ext: "png" | "jpg" | "webp" };

export function sniffImage(b: Uint8Array): Sniffed | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { mime: "image/webp", ext: "webp" };
  return null; // SVG, HTML and everything else is refused on purpose
}

/** Width/height from the PNG header (IHDR). */
export function pngSize(b: Uint8Array): { w: number; h: number } | null {
  if (b.length < 24 || sniffImage(b)?.mime !== "image/png") return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}

export type CheckResult = { ok: true; sniffed: Sniffed } | { ok: false; error: string };

export function checkLogo(b: Uint8Array): CheckResult {
  if (b.length === 0) return { ok: false, error: "err_file_missing" };
  if (b.length > MAX_LOGO_BYTES) return { ok: false, error: "err_file_big" };
  const s = sniffImage(b);
  return s ? { ok: true, sniffed: s } : { ok: false, error: "err_file_type" };
}

/** The tab icon doubles as the phone app icon, so it must be a square PNG between 192 and 1024 px. */
export function checkFavicon(b: Uint8Array): CheckResult {
  if (b.length === 0) return { ok: false, error: "err_file_missing" };
  if (b.length > MAX_FAVICON_BYTES) return { ok: false, error: "err_file_big" };
  const s = sniffImage(b);
  if (!s || s.mime !== "image/png") return { ok: false, error: "err_file_type" };
  const size = pngSize(b);
  if (!size) return { ok: false, error: "err_file_type" };
  if (size.w !== size.h) return { ok: false, error: "err_not_square" };
  if (size.w < FAVICON_MIN || size.w > FAVICON_MAX) return { ok: false, error: "err_size_range" };
  return { ok: true, sniffed: s };
}
