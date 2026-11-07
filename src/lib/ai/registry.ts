import { PROVIDER_IDS, type ProviderId, type TaskKind } from "./types";

/**
 * What the code knows about each provider: where its key lives and the model each task uses by default. Model names change and disappear faster than code,
 * so an administrator can override them (see route.ts); these are the values that always work when nothing is set.
 * Prices and names are as of Nov 2026 (USD per million tokens in/out): check the provider's own list before relying on them.
 */
export const PROVIDERS: Record<ProviderId, { label: string; envKey: string; capabilities: string; models: Record<TaskKind, string>; hint: string }> = {
  anthropic: { label: "Anthropic Claude", envKey: "ANTHROPIC_API_KEY", capabilities: "text · tools · images · PDF", models: { chat: "claude-sonnet-5-5", prompt_review: "claude-haiku-5-5" }, hint: "Sonnet 5.5 ≈ $2 / $10 · Haiku 5.5 ≈ $0.10 / $0.50 · Opus 5.5 ≈ $4 / $20 (not a default: the most expensive)" },
  google: { label: "Google Gemini", envKey: "GOOGLE_AI_API_KEY", capabilities: "text · tools · images · PDF · audio", models: { chat: "gemini-3-flash-preview", prompt_review: "gemini-flash-lite-latest" }, hint: "Gemini 3 Flash ≈ $0.50 / $3.00 · Flash-Lite ≈ $0.30 / $2.50. A free-tier key must not be used with travelers' data." },
};
/** Which provider a task tries first and which one is the spare ("none" = no spare). */
export const TASK_ROUTES: Record<TaskKind, { primary: ProviderId; fallback: ProviderId | null; why: string }> = {
  chat: { primary: "anthropic", fallback: "google", why: "Good in Thai and in following rules; short answers with the service's own tools" },
  prompt_review: { primary: "anthropic", fallback: "google", why: "Small and cheap; a safety check that must always be answered" },
};
export const MODEL_RE = /^[A-Za-z0-9._:/-]{1,100}$/;
export const isProvider = (v: unknown): v is ProviderId => typeof v === "string" && (PROVIDER_IDS as readonly string[]).includes(v);
