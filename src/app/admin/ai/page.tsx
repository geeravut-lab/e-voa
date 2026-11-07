import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfigured, loadAi } from "@/lib/ai/settings";
import { saveAiAction, saveAiRoutingAction } from "@/app/actions/admin";
import { AiTestButton } from "@/components/AiTestButton";
import { PROVIDERS } from "@/lib/ai/registry";
import { modelFor } from "@/lib/ai/route";
import { keyStatus, listModelsFor, loadRouting } from "@/lib/ai/server";
import { PROVIDER_IDS, TASK_KINDS } from "@/lib/ai/types";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function AdminAi() {
  await requireAdminPage("config");
  const { t } = await getT();
  const cfg = await loadAi();
  const routing = await loadRouting();
  const keys = Object.fromEntries(keyStatus().map((k) => [k.provider, k.hasKey]));
  const lists = Object.fromEntries(await Promise.all(PROVIDER_IDS.map(async (p) => [p, await listModelsFor(p)] as const)));
  const { data: events } = await createAdminClient().from("ai_events").select("id, at, provider, task, status, code, message").order("at", { ascending: false }).limit(20);
  const tt = t as unknown as Record<string, string>;
  const { data: rows } = await createAdminClient().from("ai_usage").select("day, requests, input_tokens, output_tokens").order("day", { ascending: false }).limit(7);
  const num = (name: string, label: string, v: number) => <label className="block space-y-1"><span className="text-sm font-semibold">{label}</span><input name={name} type="number" defaultValue={v} className={`${inputCls} tabular`} /></label>;
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_ai_title} hint={t.admin_ai_hint} art="ai" tone="sky" />
      {!aiConfigured() && <p role="alert" className="rounded-card border border-gold bg-gold-soft p-4 text-sm font-semibold text-gold-deep">⚠ {t.admin_ai_nokey}</p>}
      <ActionForm action={saveAiAction} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="enabled" defaultChecked={cfg.enabled} className="mt-1 h-5 w-5" /><span>{t.admin_ai_enabled}</span></label>
        {num("daily_token_budget", t.admin_ai_budget, cfg.daily_token_budget)}{num("max_output_tokens", t.admin_ai_maxout, cfg.max_output_tokens)}{num("per_user_hourly", t.admin_ai_per_user, cfg.per_user_hourly)}{num("per_visitor_hourly", t.admin_ai_per_visitor, cfg.per_visitor_hourly)}
        <p className="text-xs text-muted">{t.admin_ai_note}</p>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
      <ActionForm action={saveAiRoutingAction} className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <div><h2 className="font-display text-lg font-bold">{t.admin_ai_routing}</h2><p className="text-xs text-muted">{t.admin_ai_routing_hint}</p></div>
        <p className="flex flex-wrap gap-2 text-xs">{PROVIDER_IDS.map((p) => <span key={p} className={`rounded-full border px-2 py-1 font-semibold ${keys[p] ? "border-success text-success" : "border-line text-muted"}`}>{PROVIDERS[p].label}: {keys[p] ? t.ai_key_ok : t.ai_key_missing}</span>)}</p>
        {TASK_KINDS.map((task) => {
          const r = routing.routes[task] ?? {};
          return (
            <fieldset key={task} className="space-y-3 rounded-card border border-line p-4">
              <legend className="px-1 text-sm font-bold">{tt[`ai_task_${task}`]}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1"><span className="text-sm font-semibold">{t.ai_primary}</span>
                  <select name={`primary_${task}`} defaultValue={r.primary ?? ""} className={inputCls}><option value="">{t.ai_use_default}</option>{PROVIDER_IDS.map((p) => <option key={p} value={p} disabled={!keys[p]}>{PROVIDERS[p].label}</option>)}</select></label>
                <label className="block space-y-1"><span className="text-sm font-semibold">{t.ai_fallback}</span>
                  <select name={`fallback_${task}`} defaultValue={r.fallback ?? ""} className={inputCls}><option value="">{t.ai_use_default}</option><option value="none">{t.ai_fallback_none}</option>{PROVIDER_IDS.map((p) => <option key={p} value={p} disabled={!keys[p]}>{PROVIDERS[p].label}</option>)}</select></label>
              </div>
              {PROVIDER_IDS.map((p) => {
                const field = `model_${p}_${task}`, current = modelFor(p, task, routing);
                return (
                  <div key={p} className="flex flex-wrap items-end gap-2">
                    <label className="block w-full min-w-0 flex-1 space-y-1 sm:w-auto"><span className="text-xs font-semibold text-muted">{PROVIDERS[p].label} · {t.ai_model_for}</span>
                      <input name={field} defaultValue={current} list={`models_${p}`} className={`${inputCls} font-mono`} autoComplete="off" spellCheck={false} /></label>
                    <AiTestButton provider={p} field={field} fallbackModel={current} />
                  </div>
                );
              })}
            </fieldset>
          );
        })}
        {PROVIDER_IDS.map((p) => <datalist key={p} id={`models_${p}`}>{(lists[p] ?? []).map((m) => <option key={m} value={m} />)}</datalist>)}
        <ul className="list-disc space-y-1 ps-5 text-xs text-muted">{PROVIDER_IDS.map((p) => <li key={p}>{PROVIDERS[p].label}: {PROVIDERS[p].hint}</li>)}</ul>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-1 font-display text-lg font-bold">{t.ai_events_title}</h2><p className="mb-2 text-xs text-muted">{t.ai_events_note}</p>
        {events?.length ? <ul className="space-y-1 text-xs tabular">{events.map((e) => <li key={e.id} className="flex flex-wrap gap-x-2 border-t border-line pt-1"><span className="text-muted">{new Date(e.at).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })}</span><b className={e.status === "error" ? "text-danger" : "text-gold-deep"}>{e.status}</b><span>{e.provider} · {e.task}</span><span className="font-mono">{e.code}</span><span className="text-muted">{e.message}</span></li>)}</ul> : <p className="text-sm text-muted">{t.ai_events_none}</p>}
      </section>
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-2 font-display text-lg font-bold">{t.admin_ai_usage}</h2>
        <table className="w-full text-sm tabular"><thead className="text-xs uppercase text-muted"><tr><th className="py-1 text-start">{t.audit_when}</th><th className="text-end">#</th><th className="text-end">in</th><th className="text-end">out</th></tr></thead>
          <tbody>{(rows ?? []).map((r) => <tr key={r.day} className="border-t border-line"><td className="py-1">{r.day}</td><td className="text-end">{r.requests}</td><td className="text-end">{Number(r.input_tokens).toLocaleString("en-US")}</td><td className="text-end">{Number(r.output_tokens).toLocaleString("en-US")}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}
