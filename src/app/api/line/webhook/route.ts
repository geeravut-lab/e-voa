import { NextResponse, type NextRequest } from "next/server";
import { envValue } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { DICTS } from "@/lib/i18n/dict";
import { isLang } from "@/lib/i18n/langs";
import { verifyLineSignature } from "@/lib/messaging/line";
import { bindLine, lineReply, lineUnfollowed } from "@/lib/messaging/service";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

type LineEvent = { type?: string; replyToken?: string; source?: { userId?: string }; message?: { type?: string; text?: string } };

/**
 * LINE → ThaiPass. Set this address as the Webhook URL of the official account. Every call is signed (X-Line-Signature); an unsigned or wrongly signed call gets 401 and nothing is read.
 * A text message holding the one-time code links that LINE account to the traveler who asked for the code; "unfollow" stops the notices.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 200_000 || !verifyLineSignature(raw, req.headers.get("x-line-signature"), envValue("LINE_CHANNEL_SECRET"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let events: LineEvent[] = [];
  try { events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? []; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  for (const e of events.slice(0, 20)) {
    const uid = e.source?.userId; if (!uid) continue;
    if (e.type === "unfollow") { await lineUnfollowed(uid); continue; }
    if (e.type !== "message" || e.message?.type !== "text" || !e.replyToken) continue;
    if (!(await rateLimit(`line:bind:${uid}`, 10, 600))) continue;                            // guessing codes from one LINE account is slowed down
    const code = (e.message.text ?? "").trim().toUpperCase().match(/^(?:LINK\s+)?([A-Z2-9]{8})$/)?.[1];
    if (!code) { await lineReply(e.replyToken, Object.values(DICTS).map((d) => d.chat_line_help).join("\n")); continue; }
    const r = await bindLine(code, uid);
    if (r.ok) { const { data: p } = await createAdminClient().from("profiles").select("lang").eq("id", r.ownerId).maybeSingle(); await lineReply(e.replyToken, DICTS[isLang(p?.lang) ? p.lang : "en"].chat_line_linked); }
    else await lineReply(e.replyToken, Object.values(DICTS).map((d) => d.chat_line_bad_code).join("\n"));
  }
  return NextResponse.json({ ok: true });
}
