import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { readDocument } from "@/lib/documents";
import { hasServiceRole } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Shows one stored document (decrypted on the fly) to its owner or an administrator. Everyone else gets a plain 404,
 * the same answer as for a document that does not exist. Never cached; cannot run scripts even if a file lies about its type.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!hasServiceRole()) return notFound();
  const v = await getViewer();
  if (!v.user) return notFound();
  const { id } = await ctx.params;
  const doc = await readDocument(id, { id: v.user.id, isAdmin: v.isAdmin && v.caps.includes("ops") });
  if (!doc) return notFound();
  return new NextResponse(new Uint8Array(doc.bytes), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
