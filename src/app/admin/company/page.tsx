import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { loadCompany } from "@/lib/invoice-service";
import { saveCompanyAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function AdminCompany() {
  await requireAdminPage();
  const { t } = await getT();
  const c = await loadCompany();
  const f = (name: keyof typeof c, label: string, extra = "") => <label className="block space-y-1"><span className="text-sm font-semibold">{label}</span><input name={name} defaultValue={String(c[name])} className={`${inputCls} ${extra}`} /></label>;
  const check = (name: "vat_registered" | "visa_fee_pass_through", label: string) => <label className="flex items-start gap-3 text-sm"><input type="checkbox" name={name} defaultChecked={c[name]} className="mt-1 h-5 w-5" /><span>{label}</span></label>;
  return (
    <div>
      <PageHead title={t.admin_company_title} hint={t.admin_company_hint} art="fees" tone="gold" />
      <ActionForm action={saveCompanyAction} className="space-y-4">
        <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
          {f("legal_name", t.company_name_en)}{f("legal_name_th", t.company_name_th)}{f("address", t.company_address_en)}{f("address_th", t.company_address_th)}
          <div className="grid grid-cols-[1fr_7rem] gap-2">{f("tax_id", t.company_tax_id, "font-mono")}{f("branch", t.company_branch, "font-mono")}</div>
        </section>
        <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
          {check("vat_registered", t.company_vat_registered)}{f("vat_rate", t.company_vat_rate)}{check("visa_fee_pass_through", t.company_visa_pass_through)}
        </section>
        <p className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{t.admin_company_note}</p>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
    </div>
  );
}
