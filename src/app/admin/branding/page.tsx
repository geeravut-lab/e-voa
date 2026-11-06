import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { saveBrandNameAction, uploadBrandImageAction, resetBrandImageAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
      <div>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

export default async function BrandingPage() {
  await requireAdminPage();
  const { t, brand } = await getT();
  const file = "block w-full min-h-11 rounded-control border-[1.5px] border-field bg-surface p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-sky file:px-3 file:py-2 file:font-semibold file:text-primary";
  return (
    <div className="space-y-4">
      <PageHead title={t.brand_title} hint={t.brand_delay} art="branding" tone="rose" />

      <Section title={t.brand_name} hint={t.brand_name_hint}>
        <ActionForm action={saveBrandNameAction} className="space-y-2">
          <input name="name" defaultValue={brand.name} maxLength={40} required aria-label={t.brand_name} className="min-h-11 w-full rounded-control border-[1.5px] border-field bg-surface px-3" />
          <SubmitButton>{t.brand_save_name}</SubmitButton>
        </ActionForm>
      </Section>

      {(["logo", "favicon"] as const).map((kind) => {
        const img = brand[kind];
        return (
          <Section key={kind} title={kind === "logo" ? t.brand_logo : t.brand_favicon} hint={kind === "logo" ? t.brand_logo_hint : t.brand_favicon_hint}>
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/brand/${kind}${img ? `?v=${img.version}` : ""}`} alt="" width={64} height={64} className="h-16 w-16 rounded-2xl border border-line bg-bg object-contain p-1" />
              <p className="text-sm text-muted">{t.brand_current}: {img ? new Date(img.version).toISOString().slice(0, 16).replace("T", " ") : t.brand_using_default}</p>
            </div>
            <ActionForm action={uploadBrandImageAction.bind(null, kind)} className="space-y-2">
              <input type="file" name="file" required accept={kind === "logo" ? "image/png,image/jpeg,image/webp" : "image/png"} aria-label={t.upload} className={file} />
              <SubmitButton>{t.upload}</SubmitButton>
            </ActionForm>
            {img && (
              <ActionForm action={resetBrandImageAction.bind(null, kind)}>
                <SubmitButton variant="ghost">{t.reset_default}</SubmitButton>
              </ActionForm>
            )}
          </Section>
        );
      })}
    </div>
  );
}
