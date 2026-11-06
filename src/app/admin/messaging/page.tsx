import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/env";
import { lineConfigured, loadMessaging, whatsappConfigured } from "@/lib/messaging/settings";
import { monthCount } from "@/lib/messaging/service";
import { saveMessagingAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/apply/fields";

export const dynamic = "force-dynamic";

export default async function AdminMessaging() {
  await requireAdminPage();
  const { t } = await getT();
  const [cfg, nl, nw] = await Promise.all([loadMessaging(), monthCount("line"), monthCount("whatsapp")]);
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
      <section className="space-y-1 rounded-card border border-line bg-surface p-5 text-sm shadow-card"><p className="font-semibold">{t.admin_msg_webhook}</p><p className="break-all font-mono">{SITE_URL}/api/line/webhook</p><p className="text-xs text-muted">{t.admin_msg_webhook_hint}</p></section>
    </div>
  );
}
