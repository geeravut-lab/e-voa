import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSetting } from "@/lib/settings";
import { parseEligibility } from "@/lib/eligibility";
import { saveEligibilityAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

export default async function AdminEligibility() {
  await requireAdminPage("config");
  const { t } = await getT();
  const cfg = parseEligibility(await getSetting<unknown>("eligibility", { voa: [], visa_free: [] }));
  const area = "min-h-40 w-full rounded-control border-[1.5px] border-field bg-surface p-3 font-mono text-sm";
  return (
    <div>
      <PageHead title={t.admin_elig_title} hint={t.admin_elig_hint} art="check" tone="sky" />
      <ActionForm action={saveEligibilityAction} className="space-y-4">
        <label className="block space-y-1"><span className="text-sm font-semibold">{t.admin_elig_voa}</span><textarea name="voa" defaultValue={cfg.voa.join(" ")} className={area} spellCheck={false} /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t.admin_elig_free}</span><textarea name="visa_free" defaultValue={cfg.visa_free.join(" ")} className={area} spellCheck={false} /></label>
        <p className="text-sm text-muted">{t.admin_elig_note}</p>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
    </div>
  );
}
