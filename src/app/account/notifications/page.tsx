import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { channelsOf } from "@/lib/messaging/service";
import { lineConfigured, loadMessaging, whatsappConfigured } from "@/lib/messaging/settings";
import { confirmWhatsappAction, disconnectChannelAction, startWhatsappAction, testChannelsAction } from "@/app/actions/messaging";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { LineConnect } from "@/components/LineConnect";
import { mailConfigured } from "@/lib/mailer";
import { createClient } from "@/lib/supabase/server";
import { saveEmailNoticesAction } from "@/app/actions/account";
import { fmt } from "@/lib/i18n/dict";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function NoticeChannels() {
  const v = await requireUser("/account/notifications");
  const { t } = await getT();
  const [chans, cfg] = await Promise.all([channelsOf(v.user.id), loadMessaging()]);
  const { data: prof } = await (await createClient()).from("profiles").select("email, email_notices").eq("id", v.user.id).maybeSingle();
  const line = chans.find((c) => c.channel === "line"), wa = chans.find((c) => c.channel === "whatsapp");
  const lineOn = lineConfigured() && cfg.line_enabled, waOn = whatsappConfigured() && cfg.whatsapp_enabled;
  const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card";
  const status = (c?: { status: string; masked: string | null; lastError: string | null }) => c?.status === "active" ? <p className="text-sm font-semibold text-success">✓ {t.chat_active} {c.masked}</p> : c?.status === "stopped" ? <p className="text-sm font-semibold text-gold-deep">{t.chat_stopped}</p> : c?.status === "pending" ? <p className="text-sm font-semibold text-gold-deep">{t.chat_pending}</p> : <p className="text-sm text-muted">{t.chat_not_linked}</p>;
  return (
    <div className="space-y-4">
      <PageHead title={t.chat_title} hint={t.chat_hint} art="notifications" tone="sand" />
      {mailConfigured() && prof?.email && (
        <section className={box}>
          <h2 className="font-display text-lg font-bold">{t.email_notices_title}</h2>
          <ActionForm action={saveEmailNoticesAction} className="space-y-3">
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="email_notices" defaultChecked={prof.email_notices !== false} className="mt-1 h-5 w-5" /><span>{t.email_notices_on}</span></label>
            <p className="break-all text-xs text-muted">{fmt(t.email_notices_to, { email: prof.email })}</p>
            <SubmitButton>{t.save}</SubmitButton>
          </ActionForm>
        </section>
      )}
      <section className={box}>
        <h2 className="font-display text-lg font-bold">LINE</h2>
        {!lineOn ? <p className="text-sm text-muted">{t.chat_unavailable}</p> : <>
          {status(line)}
          {line?.status !== "active" && <LineConnect pending={line?.status === "pending"} />}
          {line && <ActionForm action={disconnectChannelAction.bind(null, "line")}><SubmitButton variant="ghost">{t.chat_disconnect}</SubmitButton></ActionForm>}
        </>}
      </section>
      <section className={box}>
        <h2 className="font-display text-lg font-bold">WhatsApp</h2>
        {!waOn ? <p className="text-sm text-muted">{t.chat_unavailable}</p> : <>
          {status(wa)}
          {wa?.status !== "active" && (
            <>
              <ActionForm action={startWhatsappAction} className="space-y-2"><label className="block space-y-1"><span className="text-sm font-semibold">{t.chat_wa_phone}</span><input name="phone" inputMode="tel" required placeholder="66912345678" className={`${inputCls} font-mono`} /></label><p className="text-xs text-muted">{t.chat_wa_hint}</p><SubmitButton>{t.chat_wa_send}</SubmitButton></ActionForm>
              {wa?.waiting && <ActionForm action={confirmWhatsappAction} className="space-y-2"><label className="block space-y-1"><span className="text-sm font-semibold">{t.chat_wa_code}</span><input name="code" inputMode="numeric" maxLength={6} required className={`${inputCls} text-center font-mono text-xl tracking-[0.4em]`} /></label><SubmitButton>{t.chat_wa_confirm}</SubmitButton></ActionForm>}
            </>
          )}
          {wa && <ActionForm action={disconnectChannelAction.bind(null, "whatsapp")}><SubmitButton variant="ghost">{t.chat_disconnect}</SubmitButton></ActionForm>}
        </>}
      </section>
      {(line?.status === "active" || wa?.status === "active") && (
        <section className={box}><ActionForm action={testChannelsAction}><p className="mb-2 text-sm text-muted">{t.chat_test_hint}</p><SubmitButton variant="ghost">{t.account_test_notice}</SubmitButton></ActionForm>{[line, wa].map((c) => c?.lastError && <p key={c.channel} className="mt-2 text-xs text-danger">{c.channel}: {c.lastError}</p>)}</section>
      )}
      <p className="text-xs text-muted">{t.chat_privacy}</p>
    </div>
  );
}
