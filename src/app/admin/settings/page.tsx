import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSetting } from "@/lib/settings";
import { saveSettingsAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { DEFAULT_FEES, DEFAULT_RETENTION } from "@/config/defaults";

export const dynamic = "force-dynamic";


export default async function SettingsPage() {
  await requireAdminPage();
  const [{ t }, fees, retention] = await Promise.all([getT(), getSetting("fees", DEFAULT_FEES), getSetting("retention", DEFAULT_RETENTION)]);
  const input = "min-h-11 w-full rounded-control border-[1.5px] border-field bg-surface px-3 tabular";
  const field = (name: string, label: string, value: number) => (
    <label className="block space-y-1"><span className="text-sm font-semibold">{label}</span><input name={name} type="number" inputMode="numeric" min={0} defaultValue={value} required className={input} /></label>
  );
  return (
    <div>
      <PageHead title={t.settings_title} art="settings" tone="mint" />
      <ActionForm action={saveSettingsAction} className="space-y-4">
        <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">{t.settings_fees}</h2>
          {field("visa_thb", t.settings_fee_visa, fees.visa_thb ?? DEFAULT_FEES.visa_thb)}
          {field("regular_service_thb", t.settings_fee_regular, fees.regular_service_thb ?? DEFAULT_FEES.regular_service_thb)}
          {field("express_service_thb", t.settings_fee_express, fees.express_service_thb ?? DEFAULT_FEES.express_service_thb)}
        </section>
        <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
          {field("document_days", t.settings_retention, retention.document_days ?? DEFAULT_RETENTION.document_days)}
          <p className="text-sm text-muted">{t.settings_retention_hint}</p>
        </section>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
    </div>
  );
}
