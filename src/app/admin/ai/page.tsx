import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfigured, loadAi } from "@/lib/ai/settings";
import { saveAiAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function AdminAi() {
  await requireAdminPage();
  const { t } = await getT();
  const cfg = await loadAi();
  const { data: rows } = await createAdminClient().from("ai_usage").select("day, requests, input_tokens, output_tokens").order("day", { ascending: false }).limit(7);
  const num = (name: string, label: string, v: number) => <label className="block space-y-1"><span className="text-sm font-semibold">{label}</span><input name={name} type="number" defaultValue={v} className={`${inputCls} tabular`} /></label>;
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_ai_title} hint={t.admin_ai_hint} art="help" tone="sky" />
      {!aiConfigured() && <p role="alert" className="rounded-card border border-gold bg-gold-soft p-4 text-sm font-semibold text-gold-deep">⚠ {t.admin_ai_nokey}</p>}
      <ActionForm action={saveAiAction} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="enabled" defaultChecked={cfg.enabled} className="mt-1 h-5 w-5" /><span>{t.admin_ai_enabled}</span></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t.admin_ai_model}</span><input name="model" defaultValue={cfg.model} className={`${inputCls} font-mono`} /></label>
        {num("daily_token_budget", t.admin_ai_budget, cfg.daily_token_budget)}{num("max_output_tokens", t.admin_ai_maxout, cfg.max_output_tokens)}{num("per_user_hourly", t.admin_ai_per_user, cfg.per_user_hourly)}{num("per_visitor_hourly", t.admin_ai_per_visitor, cfg.per_visitor_hourly)}
        <p className="text-xs text-muted">{t.admin_ai_note}</p>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-2 font-display text-lg font-bold">{t.admin_ai_usage}</h2>
        <table className="w-full text-sm tabular"><thead className="text-xs uppercase text-muted"><tr><th className="py-1 text-left">{t.audit_when}</th><th className="text-right">#</th><th className="text-right">in</th><th className="text-right">out</th></tr></thead>
          <tbody>{(rows ?? []).map((r) => <tr key={r.day} className="border-t border-line"><td className="py-1">{r.day}</td><td className="text-right">{r.requests}</td><td className="text-right">{Number(r.input_tokens).toLocaleString("en-US")}</td><td className="text-right">{Number(r.output_tokens).toLocaleString("en-US")}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}
