// The runner: choose the route, call, retry once, use the spare once, and say what happened. Pure: everything it touches is passed in, so the tests need no network.
import { resolveRoute, shouldRetrySame, shouldTryFallback, type AiRouting, type Route } from "./route";
import { AiError, type AiRequest, type AiResponse, type ProviderAdapter, type ProviderId, type TaskKind } from "./types";

export type AiEvent = { provider: ProviderId; task: TaskKind; status: "fallback" | "error"; code: string; message: string };
export type RunDeps = {
  settings: () => Promise<AiRouting>;
  keyFor: (p: ProviderId) => string | null;
  adapter: (p: ProviderId) => ProviderAdapter;
  log: (e: AiEvent) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
};

const short = (s: string, n: number) => s.slice(0, n);
const asAiError = (e: unknown) => (e instanceof AiError ? e : new AiError("provider_failed", (e as Error)?.message ?? "unknown"));

async function callWithRetry(d: RunDeps, p: { provider: ProviderId; model: string }, req: AiRequest, task: TaskKind): Promise<AiResponse> {
  const key = d.keyFor(p.provider); if (!key) throw new AiError("not_configured", `${p.provider} has no key`);
  try { return await d.adapter(p.provider).call(req, p.model, key, task); }
  catch (e) {
    const err = asAiError(e);
    if (!shouldRetrySame(err)) throw err;
    await (d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(1200);           // a busy answer usually clears in a second
    return d.adapter(p.provider).call(req, p.model, key, task);
  }
}

/**
 * primary (+ one retry) → spare (+ one retry) → error. Only fallbacks and errors are logged (successes would be thousands of rows with nothing to see), and a log
 * never contains the question or the answer: only provider, task, an error code and a short message.
 */
export async function runAiWith(d: RunDeps, task: TaskKind, req: AiRequest): Promise<AiResponse> {
  const route: Route | null = resolveRoute(task, await d.settings(), (p) => !!d.keyFor(p));
  if (!route) throw new AiError("not_configured", "no AI provider has a key");
  const safeLog = (e: AiEvent) => d.log(e).catch(() => {});             // a failing log must never hide the real error
  if (route.primarySkipped) await safeLog({ provider: route.primarySkipped, task, status: "fallback", code: "missing_api_key", message: short(`${route.primarySkipped} is chosen but has no key; ${route.primary.provider} answers instead`, 300) });
  try { return await callWithRetry(d, route.primary, req, task); }
  catch (e) {
    const err = asAiError(e);
    if (!route.fallback || !shouldTryFallback(err)) { await safeLog({ provider: route.primary.provider, task, status: "error", code: short(err.code === "provider_failed" ? `http_${err.status ?? "net"}` : err.code, 64), message: short(err.message, 300) }); throw err; }
    await safeLog({ provider: route.primary.provider, task, status: "fallback", code: short(err.code === "provider_failed" ? `http_${err.status ?? "net"}` : err.code, 64), message: short(err.message, 300) });
    try { return await callWithRetry(d, route.fallback, req, task); }
    catch (e2) { const err2 = asAiError(e2); await safeLog({ provider: route.fallback.provider, task, status: "error", code: short(err2.code === "provider_failed" ? `http_${err2.status ?? "net"}` : err2.code, 64), message: short(err2.message, 300) }); throw err2; }
  }
}
