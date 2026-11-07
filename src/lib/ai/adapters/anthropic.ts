import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { envValue } from "@/lib/env";
import { AiError, type AiRequest, type AiResponse, type ProviderAdapter, type TaskKind, type Turn } from "../types";

const client = (apiKey: string) => new Anthropic({ apiKey, baseURL: envValue("ANTHROPIC_BASE_URL") || "https://api.anthropic.com", maxRetries: 0, timeout: 45_000 });     // the address is pinned: a gateway that a host injects through the environment must not receive travelers' questions

/** Neutral turns → Messages API. The provider's own copy of an earlier answer is replayed as it is (it carries what the API needs for tool use). */
export function toMessages(turns: Turn[]): Anthropic.MessageParam[] {
  return turns.map((t): Anthropic.MessageParam => {
    if (t.role === "user") return { role: "user", content: t.text };
    if (t.role === "assistant") {
      if (t.raw?.provider === "anthropic") return { role: "assistant", content: t.raw.value as Anthropic.ContentBlockParam[] };
      return { role: "assistant", content: [...(t.text ? [{ type: "text" as const, text: t.text }] : []), ...t.calls.map((c) => ({ type: "tool_use" as const, id: c.id, name: c.name, input: (c.input ?? {}) as Record<string, unknown> }))] };
    }
    return { role: "user", content: t.results.map((r) => ({ type: "tool_result" as const, tool_use_id: r.id, content: r.content })) };           // every result of one round in ONE user message
  });
}

export const anthropicAdapter: ProviderAdapter = {
  id: "anthropic",
  async call(req: AiRequest, model: string, apiKey: string, task: TaskKind): Promise<AiResponse> {
    try {
      const res = await client(apiKey).messages.create({
        model, max_tokens: req.maxTokens, system: req.system, messages: toMessages(req.turns),
        ...(req.tools?.length ? { tools: req.tools as unknown as Anthropic.Tool[] } : {}),
        ...(task === "chat" ? { output_config: { effort: "low" } } : {}),                      // short factual answers: low effort keeps it fast and cheap
      } as Anthropic.MessageCreateParamsNonStreaming);
      const calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, input: b.input }));
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      return { text, calls, raw: { provider: "anthropic", value: res.content }, provider: "anthropic", model, stop: res.stop_reason === "refusal" ? "refusal" : res.stop_reason === "tool_use" && calls.length ? "tools" : res.stop_reason === "max_tokens" ? "length" : "end",
        usage: { inputTokens: res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0), outputTokens: res.usage.output_tokens } };
    } catch (e) {
      if (e instanceof Anthropic.APIError) throw new AiError("provider_failed", `anthropic ${e.status}: ${String(e.message).slice(0, 200)}`, e.status);
      throw new AiError("provider_failed", `anthropic: ${(e as Error).message}`);
    }
  },
  async listModels(apiKey: string): Promise<string[]> {
    const out: string[] = [];
    for await (const m of client(apiKey).models.list({ limit: 100 })) { out.push(m.id); if (out.length >= 200) break; }
    return out;
  },
};
