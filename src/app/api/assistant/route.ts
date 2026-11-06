import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { featureEnabled } from "@/lib/flags";
import { getLang } from "@/lib/i18n/server";
import { clientId, rateLimit } from "@/lib/ratelimit";
import { cleanMessages, runAssistant } from "@/lib/ai/assistant";
import { aiConfigured, loadAi } from "@/lib/ai/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The help assistant. Body: { messages: [{role, content}] } (the browser keeps the conversation; nothing is stored here). Answers { reply } or { error: "err_…" }. */
export async function POST(req: NextRequest) {
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!(await featureEnabled("ai_assistant")) || !aiConfigured() || !(await loadAi()).enabled) return fail("err_ai_unavailable", 503);
  const messages = cleanMessages((await req.json().catch(() => null) as { messages?: unknown } | null)?.messages);
  if (!messages) return fail("err_ai_input", 400);
  const v = await getViewer(); const cfg = await loadAi();
  const ok = v.user ? await rateLimit(`ai:u:${v.user.id}`, cfg.per_user_hourly, 3600) : await rateLimit(`ai:v:${await clientId()}`, cfg.per_visitor_hourly, 3600);
  if (!ok) return fail("err_rate_limited", 429);
  const r = await runAssistant(messages, { userId: v.user?.id ?? null, lang: await getLang() });
  return r.ok ? NextResponse.json({ reply: r.reply }, { headers: { "Cache-Control": "no-store" } }) : fail(r.error, r.error === "err_ai_budget" ? 503 : r.error === "err_ai_unavailable" ? 503 : 502);
}
