import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { loadToolkit } from "@/lib/content/toolkit-server";
import { FORM_ROWS, LIMITS, type ToolkitKind } from "@/lib/content/toolkit-store";
import { saveToolkitAction, resetToolkitAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";
const BLANK = 3;                                                                          // empty rows offered for adding
const LEVELS = ["illegal", "restricted", "respect", "careful"] as const;

export default async function ToolkitAdmin() {
  await requireAdminPage("content");
  const { t } = await getT();
  const tk = await loadToolkit(), m = t as unknown as Record<string, string>;
  const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card", row = "space-y-2 rounded-control border border-line p-3";
  const field = (name: string, label: string, value = "", o: { max?: number; area?: boolean; req?: boolean; lang?: string } = {}) => (
    <label className="block space-y-1 text-xs font-semibold text-muted">{label}
      {o.area ? <textarea name={name} defaultValue={value} maxLength={o.max} rows={3} lang={o.lang} className={`${inputCls} min-h-20 py-2 text-sm font-normal text-ink`} /> : <input name={name} defaultValue={value} maxLength={o.max} required={o.req} lang={o.lang} className={`${inputCls} text-sm font-normal text-ink`} />}
    </label>
  );
  const del = (name: string) => <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-danger"><input type="checkbox" name={name} className="h-5 w-5" />{t.admin_tk_delete}</label>;
  const tri = (p: string, label: string, v: { en: string; th: string; "zh-CN": string } | null, max: number, area = false) => (
    <div className="grid gap-2 sm:grid-cols-3">{field(`${p}.en`, `${label} · EN`, v?.en, { max, area })}{field(`${p}.th`, `${label} · ไทย`, v?.th && v.th !== v.en ? v.th : "", { max, area, lang: "th" })}{field(`${p}.zh`, `${label} · 中文`, v?.["zh-CN"] && v["zh-CN"] !== v.en ? v["zh-CN"] : "", { max, area, lang: "zh-CN" })}</div>
  );
  const head = (kind: ToolkitKind, title: string) => (
    <div className="space-y-1"><h2 className="font-display text-lg font-bold">{title}</h2>
      <p className={`text-xs font-semibold ${tk.edited[kind] ? "text-success" : "text-muted"}`}>{tk.edited[kind] ? m.admin_tk_edited.replace("{date}", tk.reviewed[kind] ?? "—") : m.admin_tk_builtin}</p></div>
  );
  const foot = (kind: ToolkitKind) => (
    <div className="flex flex-wrap gap-2"><SubmitButton>{t.admin_tk_save}</SubmitButton></div>
  );
  const reset = (kind: ToolkitKind) => tk.edited[kind] && <ActionForm action={resetToolkitAction.bind(null, kind)}><SubmitButton variant="ghost">{t.admin_tk_reset}</SubmitButton></ActionForm>;
  const total = (n: number) => Math.min(n + BLANK, FORM_ROWS);
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_toolkit_title} hint={t.admin_toolkit_hint} art="toolkit" tone="mint" />
      <p className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{t.admin_tk_review_note}</p>
      <p className="text-xs text-muted">{t.admin_tk_add_hint}</p>

      <section className={box}>
        {head("emergency", t.admin_tk_emergency)}
        <ActionForm action={saveToolkitAction.bind(null, "emergency")} className="space-y-3">
          {Array.from({ length: Math.min(total(tk.emergency.length), LIMITS.emergency + BLANK) }, (_, i) => { const e = tk.emergency[i]; return (
            <div key={i} className={row}>
              <div className="flex items-end gap-3">{field(`emergency.${i}.number`, t.admin_tk_number, e?.number, { max: 6 })}{e && del(`emergency.${i}.del`)}</div>
              {tri(`emergency.${i}.label`, t.admin_tk_label, e?.label ?? null, LIMITS.label)}{tri(`emergency.${i}.use`, t.admin_tk_use, e?.use ?? null, LIMITS.use)}
            </div>); })}
          {foot("emergency")}
        </ActionForm>
        {reset("emergency")}
      </section>

      <section className={box}>
        {head("phrases", t.admin_tk_phrases)}
        <ActionForm action={saveToolkitAction.bind(null, "phrases")} className="space-y-3">
          {Array.from({ length: total(tk.phrases.length) }, (_, i) => { const p = tk.phrases[i]; return (
            <div key={i} className={row}>
              <div className="grid gap-2 sm:grid-cols-2">{field(`phrases.${i}.th`, t.admin_tk_th, p?.th, { max: LIMITS.th, lang: "th" })}{field(`phrases.${i}.roman`, t.admin_tk_roman, p?.roman, { max: LIMITS.roman })}</div>
              <div className="grid gap-2 sm:grid-cols-2">{field(`phrases.${i}.en`, `${t.admin_tk_meaning} · EN`, p?.en, { max: LIMITS.meaning })}{field(`phrases.${i}.zh`, `${t.admin_tk_meaning} · 中文`, p && p.zh !== p.en ? p.zh : "", { max: LIMITS.meaning, lang: "zh-CN" })}</div>
              <div className="flex flex-wrap gap-4"><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" name={`phrases.${i}.urgent`} defaultChecked={!!p?.urgent} className="h-5 w-5" />{t.admin_tk_urgent}</label>{p && del(`phrases.${i}.del`)}</div>
            </div>); })}
          {foot("phrases")}
        </ActionForm>
        {reset("phrases")}
      </section>

      <section className={box}>
        {head("rules", t.admin_tk_rules)}
        <ActionForm action={saveToolkitAction.bind(null, "rules")} className="space-y-3">
          {Array.from({ length: total(tk.rules.length) }, (_, i) => { const r = tk.rules[i]; return (
            <div key={i} className={row}>
              <label className="block space-y-1 text-xs font-semibold text-muted">{t.admin_tk_level}
                <select name={`rules.${i}.level`} defaultValue={r?.level ?? "careful"} className={`${inputCls} text-sm font-normal text-ink`}>{LEVELS.map((l) => <option key={l} value={l}>{m[`admin_tk_level_${l}`]}</option>)}</select></label>
              {tri(`rules.${i}.title`, t.admin_tk_title_f, r?.title ?? null, LIMITS.title)}{tri(`rules.${i}.text`, t.admin_tk_text, r?.text ?? null, LIMITS.text, true)}
              {r && del(`rules.${i}.del`)}
            </div>); })}
          {foot("rules")}
        </ActionForm>
        {reset("rules")}
      </section>

      <section className={box}>
        {head("incidents", t.admin_tk_incidents)}
        <ActionForm action={saveToolkitAction.bind(null, "incidents")} className="space-y-3">
          {Array.from({ length: total(tk.incidents.length) }, (_, i) => { const c = tk.incidents[i]; return (
            <div key={i} className={row}>
              <div className="grid gap-2 sm:grid-cols-2">{field(`incidents.${i}.id`, t.admin_tk_id, c?.id, { max: 40 })}{field(`incidents.${i}.call`, t.admin_tk_call, c?.call.join(" "), { max: 40 })}</div>
              {tri(`incidents.${i}.title`, t.admin_tk_title_f, c?.title ?? null, LIMITS.title)}{tri(`incidents.${i}.summary`, t.admin_tk_summary, c?.summary ?? null, LIMITS.summary)}
              <div className="grid gap-2 sm:grid-cols-3">
                {field(`incidents.${i}.steps.en`, `${t.admin_tk_steps} · EN`, c?.steps.en.join("\n"), { area: true, max: LIMITS.steps * LIMITS.step })}
                {field(`incidents.${i}.steps.th`, `${t.admin_tk_steps} · ไทย`, c && c.steps.th !== c.steps.en ? c.steps.th.join("\n") : "", { area: true, max: LIMITS.steps * LIMITS.step, lang: "th" })}
                {field(`incidents.${i}.steps.zh`, `${t.admin_tk_steps} · 中文`, c && c.steps["zh-CN"] !== c.steps.en ? c.steps["zh-CN"].join("\n") : "", { area: true, max: LIMITS.steps * LIMITS.step, lang: "zh-CN" })}
              </div>
              {c && del(`incidents.${i}.del`)}
            </div>); })}
          {foot("incidents")}
        </ActionForm>
        {reset("incidents")}
      </section>
    </div>
  );
}
