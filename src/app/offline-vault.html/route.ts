import { NextResponse } from "next/server";
import { getLang } from "@/lib/i18n/server";
import { renderVaultPage } from "@/lib/vault/page";

export const dynamic = "force-dynamic";
/** The offline vault page (document vault + bilingual health card). It holds no personal data: the service worker keeps a copy, and what a traveler saves stays in the phone's own storage. */
export async function GET() {
  return new NextResponse(renderVaultPage(await getLang()), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" } });
}
