import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { errorText, fmt } from "@/lib/i18n/dict";
import { erasureBlockers } from "@/lib/privacy/service";
import { eraseAccountAction } from "@/app/actions/privacy";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { ExportLink } from "@/components/ExportLink";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const v = await requireUser("/account/privacy");
  const { t } = await getT();
  const blockers = await erasureBlockers(v.user.id), email = v.user.email ?? "";
  const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card";
  return (
    <div className="space-y-4">
      <PageHead title={t.account_privacy} hint={t.privacy_hint} art="account" tone="sky" />
      <section className={box}>
        <h2 className="font-display text-lg font-bold">{t.privacy_export_title}</h2>
        <p className="text-sm text-muted">{t.privacy_export_text}</p>
        <ExportLink href="/account/privacy/export">{t.privacy_export_btn}</ExportLink>
      </section>
      <section className={box}>
        <h2 className="font-display text-lg font-bold">{t.privacy_keep_title}</h2>
        <p className="text-sm text-muted">{t.privacy_keep_text}</p>
      </section>
      <section className={`${box} border-danger`}>
        <h2 className="font-display text-lg font-bold text-danger">{t.privacy_erase_title}</h2>
        <p className="text-sm">{t.privacy_erase_text}</p>
        {blockers.length > 0 ? (
          <div role="alert" className="space-y-1 rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">
            <p>{t.privacy_blocked}</p><ul className="list-disc ps-5">{blockers.map((b) => <li key={b}>{errorText(b, t)}</li>)}</ul>
          </div>
        ) : (
          <ActionForm action={eraseAccountAction} className="space-y-3">
            <label className="block space-y-1"><span className="text-sm font-semibold">{email ? fmt(t.privacy_erase_confirm_email, { email }) : t.privacy_erase_confirm_delete}</span><input name="confirm" required autoComplete="off" className={inputCls} /></label>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="understand" className="mt-1 h-5 w-5" /><span>{t.privacy_erase_understand}</span></label>
            <SubmitButton variant="danger">{t.privacy_erase_btn}</SubmitButton>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
