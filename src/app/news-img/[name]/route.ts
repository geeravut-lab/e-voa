import { NextResponse, type NextRequest } from "next/server";
import { hasServiceRole } from "@/lib/env";
import { readNewsImage } from "@/lib/content/news-images";
import { NEWS_IMG_RE } from "@/lib/content/rich";

export const dynamic = "force-dynamic";

/** Pictures used in news. Public (news is public). The name is random and never reused, so the answer can be cached for a long time. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!NEWS_IMG_RE.test(name) || !hasServiceRole()) return new NextResponse("Not found", { status: 404 });
  try {
    const f = await readNewsImage(name);
    if (!f) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(Buffer.from(f.bytes), { headers: { "Content-Type": f.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (e) { console.error("[news] image serve failed", (e as Error).message); return new NextResponse("Not found", { status: 404 }); }
}
