import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { envValue } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { loadFees } from "@/lib/applications/service";
import { DEFAULT_REFUND_POLICY, parseRefundPolicy } from "@/lib/payments/refund-policy";
import { loadChannels } from "@/lib/channels";
import { buildSystemPrompt } from "./prompt";
import { TOOLS, runTool } from "./tools";
import { loadAi, aiConfigured } from "./settings";
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

/** One answer: a short loop (at most 4 tool rounds) over the Messages API with the service's own tools. Spending is counted per day and refused past the budget. */
export async function runAssistant(messages: ChatMessage[], ctx: { userId: string | null; lang: Lang }): Promise<AssistantResult> {
  const cfg = await loadAi();
  if (!cfg.enabled || !aiConfigured()) return { ok: false, error: "err_ai_unavailable" };
  if ((await todayTokens()) >= cfg.daily_token_budget) return { ok: false, error: "err_ai_budget" };
  const client = new Anthropic({ apiKey: envValue("ANTHROPIC_API_KEY"), baseURL: envValue("ANTHROPIC_BASE_URL") || undefined, maxRetries: 1, timeout: 45_000 });
  const [fees, policy, ch] = await Promise.all([loadFees(), getSetting<unknown>("refund_policy", DEFAULT_REFUND_POLICY).then(parseRefundPolicy), loadChannels()]);
  const system = buildSystemPrompt({ fees: { visa: fees.visa_thb, regular: fees.regular_service_thb, express: fees.express_service_thb }, refund: { visa: policy.visa_fee_refundable, addons: policy.unused_addons_refundable }, lang: ctx.lang,
    channels: [ch.website, ch.line && `LINE ${ch.line}`, ch.email, ch.phone, ch.hours].filter(Boolean).join("; ") });
  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  let inTok = 0, outTok = 0;
  try {
    for (let round = 0; round < 5; round++) {
      const res = await client.messages.create({
        model: cfg.model, max_tokens: cfg.max_output_tokens, system, messages: convo, tools: TOOLS as unknown as Anthropic.Tool[],
        output_config: { effort: "low" },                                                  // short factual answers: low effort keeps it fast and cheap
      } as Anthropic.MessageCreateParamsNonStreaming);
      inTok += res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0); outTok += res.usage.output_tokens;
      if (res.stop_reason === "refusal") return { ok: true, reply: "" };
      const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || uses.length === 0) {
        const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
        await createAdminClient().rpc("ai_usage_add", { p_in: inTok, p_out: outTok });
        return { ok: true, reply: text };
      }
      convo.push({ role: "assistant", content: res.content });
      // every tool_use gets its result in ONE user message (parallel calls)
      convo.push({ role: "user", content: await Promise.all(uses.map(async (u) => ({ type: "tool_result" as const, tool_use_id: u.id, content: await runTool(u.name, u.input, ctx) }))) });
    }
    await createAdminClient().rpc("ai_usage_add", { p_in: inTok, p_out: outTok });
    return { ok: false, error: "err_ai_failed" };
  } catch (e) {
    console.error("[ai] request failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : (e as Error).message);
    if (inTok || outTok) await createAdminClient().rpc("ai_usage_add", { p_in: inTok, p_out: outTok });
    return { ok: false, error: "err_ai_failed" };
  }
}
