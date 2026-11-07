import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/env";
import { lineConfigured, loadMessaging, whatsappConfigured } from "@/lib/messaging/settings";
import { monthCount } from "@/lib/messaging/service";
import { saveMessagingAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { mailConfigured } from "@/lib/mailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmt } from "@/lib/i18n/dict";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function AdminMessaging() {
  await requireAdminPage("config");
  const { t } = await getT();
  const [cfg, nl, nw, { data: mails }] = await Promise.all([loadMessaging(), monthCount("line"), monthCount("whatsapp"),
    createAdminClient().from("mail_log").select("ok, code").gte("at", new Date(Date.now() - 7 * 86_400_000).toISOString()).limit(5000)]);
  const sent = (mails ?? []).filter((m) => m.ok).length, failed = (mails ?? []).length - sent;
  const codes = [...(mails ?? []).filter((m) => !m.ok).reduce((a, m) => a.set(m.code ?? 0, (a.get(m.code ?? 0) ?? 0) + 1), new Map<number, number>())];
  const row = (name: string, label: string, v: number, used: number, ok: boolean) => (
    <div className="space-y-2 rounded-control border border-line p-3">
      <p className="flex items-center justify-between font-semibold"><span>{label}</span><span className={ok ? "text-success" : "text-gold-deep"}>{ok ? `✓ ${t.admin_msg_configured}` : `⚠ ${t.admin_msg_missing}`}</span></p>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" name={`${name}_enabled`} defaultChecked={name === "line" ? cfg.line_enabled : cfg.whatsapp_enabled} className="h-5 w-5" />{t.admin_msg_on}</label>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t.admin_msg_quota} ({t.admin_msg_used}: {used})</span><input name={`${name}_quota`} type="number" min={0} defaultValue={v} className={`${inputCls} tabular`} /></label>
    </div>
  );
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_msg_title} hint={t.admin_msg_hint} art="notifications" tone="sand" />
      <ActionForm action={saveMessagingAction} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        {row("line", "LINE", cfg.line_quota, nl, lineConfigured())}{row("whatsapp", "WhatsApp", cfg.whatsapp_quota, nw, whatsappConfigured())}
        <p className="text-xs text-muted">{t.admin_msg_note}</p><SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
      <section className="space-y-2 rounded-card border border-line bg-surface p-5 text-sm shadow-card">
        <h2 className="font-display text-lg font-bold">{t.admin_mail_title}</h2>
        <p className={mailConfigured() ? "font-semibold text-success" : "font-semibold text-gold-deep"}>{mailConfigured() ? `✓ ${t.admin_mail_ok}` : `⚠ ${t.admin_mail_missing}`}</p>
        <p className="tabular">{fmt(t.admin_mail_stats, { ok: String(sent), fail: String(failed) })}</p>
        {codes.length > 0 && <p className="text-xs text-muted">{t.admin_mail_codes}: {codes.map(([c, n]) => `${c || "network"} ×${n}`).join(", ")}</p>}
        <p className="text-xs text-muted">{t.admin_mail_note}</p>
      </section>
      <section className="space-y-1 rounded-card border border-line bg-surface p-5 text-sm shadow-card"><p className="font-semibold">{t.admin_msg_webhook}</p><p className="break-all font-mono">{SITE_URL}/api/line/webhook</p><p className="text-xs text-muted">{t.admin_msg_webhook_hint}</p></section>
    </div>
  );
}
