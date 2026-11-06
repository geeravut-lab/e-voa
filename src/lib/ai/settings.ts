import "server-only";
import { getSetting } from "@/lib/settings";
import { envValue } from "@/lib/env";

export type AiSettings = { enabled: boolean; model: string; daily_token_budget: number; max_output_tokens: number; per_user_hourly: number; per_visitor_hourly: number };
export const DEFAULT_AI: AiSettings = { enabled: true, model: "claude-opus-5-5", daily_token_budget: 600_000, max_output_tokens: 1200, per_user_hourly: 30, per_visitor_hourly: 10 };

const int = (v: unknown, d: number, min: number, max: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : d; };
export const parseAi = (v: unknown): AiSettings => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { enabled: o.enabled !== false, model: typeof o.model === "string" && /^claude-[a-z0-9.-]{3,40}$/.test(o.model) ? o.model : DEFAULT_AI.model,
    daily_token_budget: int(o.daily_token_budget, DEFAULT_AI.daily_token_budget, 10_000, 50_000_000), max_output_tokens: int(o.max_output_tokens, DEFAULT_AI.max_output_tokens, 200, 8000),
    per_user_hourly: int(o.per_user_hourly, DEFAULT_AI.per_user_hourly, 1, 500), per_visitor_hourly: int(o.per_visitor_hourly, DEFAULT_AI.per_visitor_hourly, 1, 200) };
};
export const loadAi = async () => parseAi(await getSetting<unknown>("ai", DEFAULT_AI));
/** The assistant needs a key. Without one the Help page simply does not show it. */
export const aiConfigured = () => Boolean(envValue("ANTHROPIC_API_KEY"));
