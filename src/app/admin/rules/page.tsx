import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { lastRun, loadRules } from "@/lib/rules/service";
import { runRulesAction, saveRulesAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  await requireAdminPage("config");
  const { t, lang } = await getT();
  const [c, last] = await Promise.all([loadRules(), lastRun()]);
  const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card";
  const row = (title: string, hint: string, on: string, checked: boolean, num?: { name: string; value: number; unit: string; min: number; max: number }) => (
    <div className="space-y-2 rounded-control border border-line p-4">
      <label className="flex items-start gap-3"><input type="checkbox" name={on} defaultChecked={checked} className="mt-0.5 size-5" /><span><b className="block text-[15px]">{title}</b><span className="block text-sm text-muted">{hint}</span></span></label>
      {num && <label className="flex items-center gap-2 ps-8 text-sm"><input type="number" name={num.name} defaultValue={num.value} min={num.min} max={num.max} className={`${inputCls} w-24 tabular`} /><span className="font-semibold">{num.unit}</span></label>}
    </div>
  );
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_rules_title} hint={t.admin_rules_hint} art="features" tone="sand" />
      <ActionForm action={saveRulesAction} className={box}>
        <h2 className="font-display text-lg font-bold">{t.rules_travelers}</h2>
        {row(t.rules_pr_title, t.rules_pr_hint, "pr_on", c.payment_reminder.enabled, { name: "pr_h", value: c.payment_reminder.after_hours, unit: t.rules_unit_hours, min: 1, max: 720 })}
        {row(t.rules_ue_title, t.rules_ue_hint, "ue_on", c.unpaid_expire.enabled, { name: "ue_d", value: c.unpaid_expire.after_days, unit: t.rules_unit_days, min: 1, max: 180 })}
        {row(t.rules_fr_title, t.rules_fr_hint, "fr_on", c.fix_reminder.enabled, { name: "fr_h", value: c.fix_reminder.after_hours, unit: t.rules_unit_hours, min: 1, max: 720 })}
        <h2 className="pt-2 font-display text-lg font-bold">{t.rules_staff}</h2>
        {row(t.rules_sw_title, t.rules_sw_hint, "sw_on", c.sla_warning.enabled, { name: "sw_h", value: c.sla_warning.before_hours, unit: t.rules_unit_hours, min: 1, max: 72 })}
        {row(t.rules_so_title, t.rules_so_hint, "so_on", c.sla_overdue.enabled)}
        <p className="text-xs text-muted">{t.rules_when}</p>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
      <ActionForm action={runRulesAction} className={box}>
        <h2 className="font-display text-lg font-bold">{t.rules_run_title}</h2>
        <p className="text-sm text-muted">{t.rules_run_hint}</p>
        {last && <p className="rounded-control bg-sky p-3 text-sm tabular">{t.rules_last.replace("{at}", new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(last.at)))}: {t.rules_pr_title} {last.payment_reminders} · {t.rules_ue_title} {last.expired} · {t.rules_fr_title} {last.fix_reminders} · {t.rules_sw_title} {last.sla_warnings} · {t.rules_so_title} {last.sla_overdue}</p>}
        <SubmitButton variant="ghost">{t.rules_run_btn}</SubmitButton>
      </ActionForm>
    </div>
  );
}
