import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { loadFlags } from "@/lib/flags";
import { FEATURE_FLAGS, FEATURE_KEYS } from "@/config/features";
import { saveFlagsAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

export default async function FeaturesPage() {
  await requireAdminPage("config");
  const [{ t }, flags] = await Promise.all([getT(), loadFlags()]);
  return (
    <div>
      <PageHead title={t.features_title} hint={t.features_hint} art="features" tone="mint" />
      <ActionForm action={saveFlagsAction} className="space-y-3">
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
          {FEATURE_KEYS.map((k) => (
            <li key={k}>
              <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-2">
                <span className="font-semibold">{FEATURE_FLAGS[k].label}</span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" name={`flag_${k}`} defaultChecked={flags[k]} className="peer sr-only" />
                  <span className="relative h-7 w-12 rounded-full bg-line transition peer-checked:bg-teal peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-primary after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
                </span>
              </label>
            </li>
          ))}
        </ul>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
    </div>
  );
}
