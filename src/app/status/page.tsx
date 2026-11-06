import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { checkStatusAction } from "@/app/actions/public";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/apply/fields";

export const generateMetadata = () => pageMeta({ path: "/status", title: "status_title", description: "seo_status" });

export default async function StatusPage() {
  const { t } = await getT();
  return (
    <div className="space-y-4">
      <PageHead title={t.status_title} hint={t.status_hint} art="trips" tone="rose" />
      <ActionForm action={checkStatusAction} className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <label className="block space-y-1"><span className="text-sm font-semibold">{t.status_ref}</span><input name="ref" required placeholder="EV-26-000001" autoCapitalize="characters" className={`${inputCls} font-mono`} /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t.apply_passport_no}</span><input name="passport" required autoCapitalize="characters" className={`${inputCls} font-mono`} /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t.apply_dob}</span><input name="dob" type="date" required className={inputCls} /></label>
        <SubmitButton className="w-full">{t.status_check}</SubmitButton>
        <p className="text-xs text-muted">{t.status_note}</p>
      </ActionForm>
    </div>
  );
}
