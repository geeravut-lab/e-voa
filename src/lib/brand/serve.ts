import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { hasServiceRole } from "@/lib/env";
import { loadBrand, readBrandFile, type BrandKind } from "./server";

const DEFAULTS: Record<BrandKind, string> = { logo: "/icons/logo-mark.svg", favicon: "/icons/favicon.svg" };

/** Serves the admin-uploaded image (ETag = version) or redirects to the built-in one. Public: the login page needs the logo. */
export async function serveBrandImage(req: NextRequest, kind: BrandKind) {
  const fallback = () =>
    NextResponse.redirect(new URL(DEFAULTS[kind], req.url), { status: 307, headers: { "Cache-Control": "public, max-age=60" } });
  if (!hasServiceRole()) return fallback();
  try {
    const image = (await loadBrand())[kind];
    if (!image) return fallback();
    const etag = `"${kind}-${image.version}"`;
    const common = {
      ETag: etag,
      "Cache-Control": "public, max-age=60, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    };
    if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: common });
    const bytes = await readBrandFile(kind, image);
    if (!bytes) return fallback();
    return new NextResponse(Buffer.from(bytes), { headers: { ...common, "Content-Type": image.mime } });
  } catch (e) {
    console.error("[brand] serve failed", kind, (e as Error).message);
    return fallback();
  }
}
