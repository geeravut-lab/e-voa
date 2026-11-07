import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { loadFees } from "@/lib/applications/service";
import { DEFAULT_REFUND_POLICY, parseRefundPolicy } from "@/lib/payments/refund-policy";
import { loadChannels } from "@/lib/channels";
import { buildSystemPrompt } from "./prompt";
import { TOOLS, runTool } from "./tools";
import { loadAi, aiConfigured } from "./settings";
import { runAi, loadExtra } from "./server";
import { screenPromptAddition, wrapAddition } from "./extra";
import type { Turn } from "./types";
import type { Lang } from "@/lib/i18n/langs";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type AssistantResult = { ok: true; reply: string } | { ok: false; error: "err_ai_unavailable" | "err_ai_budget" | "err_ai_failed" };

/** What the browser may send: at most 12 plain-text turns, each at most 2000 characters, ending with the user's question. Anything else is refused before any model call. */
export function cleanMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 12) return null;
  const out: ChatMessage[] = [];
  for (const m of input) {
    const o = m as { role?: unknown; content?: unknown };
    if ((o?.role !== "user" && o?.role !== "assistant") || typeof o.content !== "string" || o.content.length === 0 || o.content.length > 2000) return null;
    out.push({ role: o.role, content: o.content });
  }
  return out[0].role === "user" && out[out.length - 1].role === "user" ? out : null;
}

const todayTokens = async () => {
  const day = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const { data } = await createAdminClient().from("ai_usage").select("input_tokens, output_tokens").eq("day", day).maybeSingle();
  return Number(data?.input_tokens ?? 0) + Number(data?.output_tokens ?? 0);
};

/** One answer: a short loop (at most 5 model calls) over whichever provider the administrator chose, with the service's own tools. Spending is counted per day and refused past the budget. */
export async function runAssistant(messages: ChatMessage[], ctx: { userId: string | null; lang: Lang }): Promise<AssistantResult> {
  const cfg = await loadAi();
  if (!cfg.enabled || !aiConfigured()) return { ok: false, error: "err_ai_unavailable" };
  if ((await todayTokens()) >= cfg.daily_token_budget) return { ok: false, error: "err_ai_budget" };
  const [fees, policy, ch, extra] = await Promise.all([loadFees(), getSetting<unknown>("refund_policy", DEFAULT_REFUND_POLICY).then(parseRefundPolicy), loadChannels(), loadExtra()]);
  const system = buildSystemPrompt({ fees: { visa: fees.visa_thb, regular: fees.regular_service_thb, express: fees.express_service_thb }, refund: { visa: policy.visa_fee_refundable, addons: policy.unused_addons_refundable }, lang: ctx.lang,
    channels: [ch.website, ch.line && `LINE ${ch.line}`, ch.email, ch.phone, ch.hours].filter(Boolean).join("; ") })
    + (extra.chat.enabled && screenPromptAddition(extra.chat.text).ok ? wrapAddition(extra.chat.text) : "");                    // saved text is screened again here: a row edited behind the app's back is not trusted
  const turns: Turn[] = messages.map((m): Turn => (m.role === "user" ? { role: "user", text: m.content } : { role: "assistant", text: m.content, calls: [] }));
  let inTok = 0, outTok = 0;
  const bill = () => (inTok || outTok ? createAdminClient().rpc("ai_usage_add", { p_in: inTok, p_out: outTok }) : Promise.resolve());
  try {
    for (let round = 0; round < 5; round++) {
      const res = await runAi("chat", { system, turns, tools: TOOLS, maxTokens: cfg.max_output_tokens });
      inTok += res.usage.inputTokens; outTok += res.usage.outputTokens;
      if (res.stop === "refusal") { await bill(); return { ok: true, reply: "" }; }
      if (res.stop !== "tools" || res.calls.length === 0) { await bill(); return { ok: true, reply: res.text }; }
      turns.push({ role: "assistant", text: res.text, calls: res.calls, raw: res.raw });
      // every tool call gets its result in ONE message (parallel calls)
      turns.push({ role: "tool", results: await Promise.all(res.calls.map(async (c) => ({ id: c.id, name: c.name, content: await runTool(c.name, c.input, ctx) }))) });
    }
    await bill();
    return { ok: false, error: "err_ai_failed" };
  } catch (e) {
    console.error("[ai] request failed", (e as Error).message);
    await bill();
    return { ok: false, error: "err_ai_failed" };
  }
}
