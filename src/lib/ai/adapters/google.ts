import "server-only";
import { envValue } from "@/lib/env";
import { AiError, type AiRequest, type AiResponse, type ProviderAdapter, type Turn } from "../types";

const base = () => (envValue("GOOGLE_AI_BASE_URL") || "https://generativelanguage.googleapis.com").replace(/\/$/, "");          // pinned for the same reason as the Anthropic address
type Part = { text?: string; functionCall?: { name: string; args?: unknown }; functionResponse?: { name: string; response: unknown }; thoughtSignature?: string };
type Content = { role: "user" | "model"; parts: Part[] };

/** Neutral turns → Gemini contents. An earlier answer of Gemini is replayed as it is (Gemini 3 needs its thought signatures back for tool use). */
export function toContents(turns: Turn[]): Content[] {
  return turns.map((t): Content => {
    if (t.role === "user") return { role: "user", parts: [{ text: t.text }] };
    if (t.role === "assistant") {
      if (t.raw?.provider === "google") return t.raw.value as Content;
      return { role: "model", parts: [...(t.text ? [{ text: t.text }] : []), ...t.calls.map((c) => ({ functionCall: { name: c.name, args: c.input ?? {} } }))] };
    }
    return { role: "user", parts: t.results.map((r) => ({ functionResponse: { name: r.name, response: { content: r.content } } })) };
  });
}
/** Gemini 3 "thinks" before it answers and counts that thinking in the output limit: ask for little thinking and leave room, or a long answer is cut off in the middle. */
export const thinksFirst = (model: string) => /^gemini-(3|flash)/.test(model);
const stripSchema = (s: unknown): unknown => (Array.isArray(s) ? s.map(stripSchema) : s && typeof s === "object" ? Object.fromEntries(Object.entries(s as Record<string, unknown>).filter(([k]) => k !== "additionalProperties").map(([k, v]) => [k, stripSchema(v)])) : s);

export const googleAdapter: ProviderAdapter = {
  id: "google",
  async call(req: AiRequest, model: string, apiKey: string): Promise<AiResponse> {
    let res: Response;
    try {
      res = await fetch(`${base()}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(45_000), cache: "no-store",
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] }, contents: toContents(req.turns),
          ...(req.tools?.length ? { tools: [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parameters: stripSchema(t.input_schema) })) }] } : {}),
          generationConfig: { maxOutputTokens: req.maxTokens + (thinksFirst(model) ? 2048 : 0), ...(thinksFirst(model) ? { thinkingConfig: { thinkingLevel: "LOW" } } : {}), ...(req.json ? { responseMimeType: "application/json" } : {}) },
        }),
      });
    } catch (e) { throw new AiError("provider_failed", `google: ${(e as Error).message}`); }
    const body = (await res.json().catch(() => null)) as { candidates?: { content?: Content; finishReason?: string }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }; error?: { message?: string; status?: string } } | null;
    if (!res.ok) {
      const msg = String(body?.error?.message ?? res.statusText).slice(0, 200);
      throw new AiError(res.status === 429 && /free_tier|free tier/i.test(msg) ? "free_tier" : "provider_failed", `google ${res.status}: ${msg}`, res.status);
    }
    const cand = body?.candidates?.[0];
    if (!cand?.content) throw new AiError("bad_output", `google: no answer (${cand?.finishReason ?? "empty"})`);
    const parts = cand.content.parts ?? [];
    const calls = parts.filter((p) => p.functionCall).map((p, i) => ({ id: `g${Date.now().toString(36)}${i}`, name: p.functionCall!.name, input: p.functionCall!.args ?? {} }));
    const text = parts.filter((p) => typeof p.text === "string").map((p) => p.text).join("\n").trim();
    return { text, calls, raw: { provider: "google", value: cand.content }, provider: "google", model, stop: calls.length ? "tools" : cand.finishReason === "MAX_TOKENS" ? "length" : cand.finishReason === "SAFETY" ? "refusal" : "end",
      usage: { inputTokens: body?.usageMetadata?.promptTokenCount ?? 0, outputTokens: (body?.usageMetadata?.candidatesTokenCount ?? 0) + (body?.usageMetadata?.thoughtsTokenCount ?? 0) } };
  },
  /** Only text models that can answer (not speech, image, embedding, live or robotics models). */
  async listModels(apiKey: string): Promise<string[]> {
    const res = await fetch(`${base()}/v1beta/models?pageSize=100`, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (!res.ok) throw new AiError("provider_failed", `google ${res.status}`, res.status);
    const j = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    return (j.models ?? []).filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name.replace(/^models\//, "")).filter((n) => /^gemini/.test(n) && !/tts|image|embed|live|audio|robotics|computer-use/i.test(n));
  },
};
