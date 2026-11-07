import { NextResponse } from "next/server";
import { loadToolkit } from "@/lib/content/toolkit-server";
import { renderOfflineEmergency } from "@/lib/content/toolkit-store";

export const dynamic = "force-dynamic";
/** The offline emergency page, built from the current lists. The service worker keeps a copy and refreshes it whenever the phone is online. */
export async function GET() {
  const html = renderOfflineEmergency(await loadToolkit());
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "X-Robots-Tag": "noindex" } });
}
