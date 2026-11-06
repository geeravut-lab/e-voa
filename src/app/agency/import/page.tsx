import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { membershipOf } from "@/lib/agency/service";
import { CSV_COLUMNS, CSV_MAX_ROWS } from "@/lib/agency/csv";
import { importTravelersAction } from "@/app/actions/agency";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const v = await requireUser("/agency/import");
  const m = await membershipOf(v.user.id); if (!m || m.agency.status !== "active") notFound();
  const { t } = await getT();
  return (
    <div className="space-y-4">
      <PageHead title={t.agency_import} hint={t.agency_import_hint.replace("{max}", String(CSV_MAX_ROWS))} art="travelers" tone="sand" />
      <section className="space-y-2 rounded-card border border-line bg-surface p-5 text-sm shadow-card">
        <p>{t.agency_import_cols}: <span className="font-mono text-xs">{CSV_COLUMNS.join(", ")}</span></p>
        <p className="text-muted">{t.agency_import_rules}</p>
        <a href="/agency/template.csv" className="font-semibold text-primary underline" download>{t.agency_import_template}</a>
      </section>
      <ActionForm action={importTravelersAction} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <input name="file" type="file" accept=".csv,text/csv" className="block w-full min-w-0 text-sm" aria-label={t.agency_import_file} />
        <textarea name="text" rows={6} placeholder={t.agency_import_paste} className={`${inputCls} font-mono text-xs`} />
        <SubmitButton>{t.agency_import_go}</SubmitButton>
      </ActionForm>
    </div>
  );
}
