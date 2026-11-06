import { getT } from "@/lib/i18n/server";
import { HeroThailand } from "./Art";
import { LogoMark } from "./Logo";

/** The colourful "Hello" card at the top of the home pages (travelers and back office). The white veil on top keeps the words readable on the picture. */
export async function GreetingCard({ title, subtitle }: { title: string; subtitle: string }) {
  const { t, brand } = await getT();
  return (
    <section className="relative isolate overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="absolute inset-0 -z-10"><HeroThailand /></div>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-white/95 via-white/75 via-50% to-white/0 to-80%" />
      <div className="flex items-center gap-4 p-4 sm:p-5">
        <LogoMark size={64} version={brand.logo?.version} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted">{t.app_name}</p>
          <h1 className="font-display text-2xl font-extrabold text-ink md:text-3xl">{title}</h1>
          <p className="mt-0.5 max-w-[16rem] text-sm font-medium text-ink/80 sm:max-w-sm">{subtitle}</p>
        </div>
      </div>
      <div aria-hidden="true" className="h-20 sm:h-28" />
    </section>
  );
}
