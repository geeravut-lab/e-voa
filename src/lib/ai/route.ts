// Which provider and model a task uses right now. Pure (no database, no network): the admin page, the runner and the tests share it.
import { MODEL_RE, PROVIDERS, TASK_ROUTES, isProvider } from "./registry";
import { PROVIDER_IDS, TASK_KINDS, type AiError, type ProviderId, type TaskKind } from "./types";

export type AiRouting = { routes: Partial<Record<TaskKind, { primary?: ProviderId; fallback?: ProviderId | "none" }>>; models: Partial<Record<ProviderId, Partial<Record<TaskKind, string>>>> };
export const EMPTY_ROUTING: AiRouting = { routes: {}, models: {} };

/** A damaged or half-edited setting falls back to the defaults in the code: the assistant must never go down because of a bad setting. */
export function parseRouting(v: unknown): AiRouting {
  const o = (v && typeof v === "object" ? v : {}) as { routes?: unknown; models?: unknown };
  const out: AiRouting = { routes: {}, models: {} };
  const routes = (o.routes && typeof o.routes === "object" ? o.routes : {}) as Record<string, { primary?: unknown; fallback?: unknown }>;
  for (const t of TASK_KINDS) {
    const r = routes[t]; if (!r || typeof r !== "object") continue;
    out.routes[t] = { ...(isProvider(r.primary) ? { primary: r.primary } : {}), ...(isProvider(r.fallback) || r.fallback === "none" ? { fallback: r.fallback as ProviderId | "none" } : {}) };
  }
  const models = (o.models && typeof o.models === "object" ? o.models : {}) as Record<string, Record<string, unknown>>;
  for (const p of PROVIDER_IDS) {
    const m = models[p]; if (!m || typeof m !== "object") continue;
    for (const t of TASK_KINDS) if (typeof m[t] === "string" && MODEL_RE.test(m[t] as string)) (out.models[p] ??= {})[t] = m[t] as string;
  }
  return out;
}

export type Route = { task: TaskKind; primary: { provider: ProviderId; model: string }; fallback: { provider: ProviderId; model: string } | null; primarySkipped: ProviderId | null };

export function modelFor(provider: ProviderId, task: TaskKind, s: AiRouting): string { return s.models[provider]?.[task] ?? PROVIDERS[provider].models[task]; }

/** The route to use now. A provider without a key is skipped (the spare takes over, then any provider that has a key); null = no key at all. */
export function resolveRoute(task: TaskKind, s: AiRouting, hasKey: (p: ProviderId) => boolean): Route | null {
  const base = TASK_ROUTES[task], o = s.routes[task];
  let primary: ProviderId = o?.primary ?? base.primary;
  const fb = o?.fallback === "none" ? null : o?.fallback ?? base.fallback;
  let fallback: ProviderId | null = fb && fb !== primary ? fb : null;
  let primarySkipped: ProviderId | null = null;
  if (!hasKey(primary)) {
    primarySkipped = primary;
    if (fallback && hasKey(fallback)) { primary = fallback; fallback = null; }
    else { const other = PROVIDER_IDS.find((p) => p !== primary && hasKey(p)); if (!other) return null; primary = other; fallback = null; }
  } else if (fallback && !hasKey(fallback)) fallback = null;
  return { task, primary: { provider: primary, model: modelFor(primary, task, s) }, fallback: fallback ? { provider: fallback, model: modelFor(fallback, task, s) } : null, primarySkipped };
}

/** Worth asking the spare provider? Yes for rate limits, server trouble, a dead key and network trouble; no for a request or model name of ours that is wrong (it would fail the same way). */
export function shouldTryFallback(e: Pick<AiError, "code" | "status" | "message">): boolean {
  if (e.code === "bad_output") return true;
  if (e.code === "free_tier" || e.code === "not_configured" || e.code === "unsupported") return e.code === "free_tier";
  const s = e.status;
  if (s === 429 || s === 401 || s === 403 || (typeof s === "number" && s >= 500)) return true;
  if (s === undefined) return /ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed|overloaded|timeout|aborted/i.test(e.message);
  return false;
}
export const shouldRetrySame = (e: Pick<AiError, "status">) => e.status === 503 || e.status === 429 || e.status === 529;
