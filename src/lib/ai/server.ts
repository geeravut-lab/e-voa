import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { envValue } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { anthropicAdapter } from "./adapters/anthropic";
import { googleAdapter } from "./adapters/google";
import { PROVIDERS } from "./registry";
import { parseRouting, type AiRouting } from "./route";
import { runAiWith, type AiEvent } from "./run";
import { REVIEW_SYSTEM, parseReview, parseExtra, screenPromptAddition, type ExtraSetting } from "./extra";
import { AiError, type AiRequest, type AiResponse, type ProviderAdapter, type ProviderId, type TaskKind } from "./types";

const adapters: Record<ProviderId, ProviderAdapter> = { anthropic: anthropicAdapter, google: googleAdapter };
/** The key lives only in the server environment. This is the only place that reads it; nothing here is ever shown or logged. */
export const keyFor = (p: ProviderId) => envValue(PROVIDERS[p].envKey) || null;
export const keyStatus = () => (Object.keys(PROVIDERS) as ProviderId[]).map((p) => ({ provider: p, hasKey: !!keyFor(p) }));

export const loadRouting = async (): Promise<AiRouting> => parseRouting(await getSetting<unknown>("ai_routing", {}));
export const loadExtra = async (): Promise<ExtraSetting> => parseExtra(await getSetting<unknown>("ai_prompt_extra", {}));

async function logEvent(e: AiEvent) {
  await createAdminClient().from("ai_events").insert({ provider: e.provider, task: e.task, status: e.status, code: e.code, message: e.message });
}

/** The one door to AI for the whole service. */
export const runAi = (task: TaskKind, req: AiRequest): Promise<AiResponse> =>
  runAiWith({ settings: loadRouting, keyFor, adapter: (p) => adapters[p], log: logEvent }, task, req);

/** Models a provider offers, asked from the provider itself (a name typed by hand goes stale). Kept 5 minutes; null = could not be asked. */
const g = globalThis as unknown as { __evoaModels?: Map<string, { at: number; list: string[] }> };
const modelCache = (g.__evoaModels ??= new Map());
export async function listModelsFor(p: ProviderId): Promise<string[] | null> {
  const key = keyFor(p); if (!key) return null;
  const hit = modelCache.get(p); if (hit && Date.now() - hit.at < 300_000) return hit.list;
  try { const list = (await adapters[p].listModels(key)).sort(); modelCache.set(p, { at: Date.now(), list }); return list; } catch { return null; }
}

/** The test button: asks one provider and model directly (it bypasses routing, so a spare cannot hide a broken choice). Returns a short result, never the key. */
export async function testModel(provider: ProviderId, model: string): Promise<{ ok: true; ms: number; sample: string } | { ok: false; error: string }> {
  const key = keyFor(provider); if (!key) return { ok: false, error: "err_ai_nokey" };
  const t0 = Date.now();
  try {
    const r = await adapters[provider].call({ system: "Reply with the single word OK.", turns: [{ role: "user", text: "Say OK" }], maxTokens: 20 }, model, key, "prompt_review");
    return { ok: true, ms: Date.now() - t0, sample: r.text.slice(0, 40) };
  } catch (e) {
    const err = e as AiError; console.error("[ai] test failed", provider, err.message);
    return { ok: false, error: err.status === 404 ? "err_ai_model_unknown" : err.code === "free_tier" ? "err_ai_free_tier" : "err_ai_test_failed" };
  }
}

/** Second gate: the cheap code screen first, then a small model reads it. Anything unclear, or any failure of the reviewer, is a rejection (fail closed). */
export async function reviewPromptAddition(text: string): Promise<{ ok: true } | { ok: false; error: string; reason?: string }> {
  const s = screenPromptAddition(text); if (!s.ok) return s;
  if (!text.trim()) return { ok: true };
  try {
    const r = await runAi("prompt_review", { system: REVIEW_SYSTEM, turns: [{ role: "user", text }], maxTokens: 200, json: true });
    const v = parseReview(r.text);
    return v.ok ? { ok: true } : { ok: false, error: "err_prompt_rejected", reason: v.reason };
  } catch { return { ok: false, error: "err_prompt_review_down" }; }
}
