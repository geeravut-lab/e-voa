import { redirect } from "next/navigation";
import { alternatesOf } from "@/lib/seo";
import { getLang } from "@/lib/i18n/server";
import { NAV, resolveHref } from "@/config/nav";
import { getViewer, displayNameOf } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { loadFlags } from "@/lib/flags";
import { fmt } from "@/lib/i18n/dict";
import { HomeCard } from "@/components/HomeCard";
import { HeroThailand } from "@/components/Art";
import { LogoMark } from "@/components/Logo";
import { NavRowLink } from "@/components/AppLink";
import { btnClass } from "@/components/buttonStyles";

export default async function HomePage() {
  const [viewer, { t, brand }, flags] = await Promise.all([getViewer(), getT(), loadFlags()]);
  if (viewer.isAdmin) redirect("/admin");                // staff work in the back office only
  const signedIn = !!viewer.user;
  const name = displayNameOf(viewer);
  const cards = NAV.filter((n) => n.home && (!n.feature || flags[n.feature]) && (n.area === "traveler" || viewer.isAdmin));
  // Visitors do not need "notifications" and "account" cards; they see a sign-in banner instead.
  const traveler = cards.filter((n) => n.area === "traveler" && (signedIn || !["notifications", "account"].includes(n.key)));
  const admin = cards.filter((n) => n.area === "admin");

  const render = (list: typeof cards) =>
    list.map((n) => (
      <HomeCard
        key={n.key}
        item={n}
        href={resolveHref(n, signedIn)}
        label={t[n.label]}
        sub={n.sub ? t[n.sub] : undefined}
        locked={n.auth && !signedIn}
        lockedLabel={t.home_locked}
      />
    ));

  return (
    <div className="space-y-4">
      <section className="relative isolate overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="absolute inset-0 -z-10"><HeroThailand /></div>
        {/* a white veil over the top keeps the greeting readable on top of the colourful picture */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-white/95 via-white/75 via-50% to-white/0 to-80%" />
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <LogoMark size={64} version={brand.logo?.version} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">{t.app_name}</p>
            <h1 className="font-display text-2xl font-extrabold text-ink md:text-3xl">{signedIn && name ? fmt(t.home_hello_name, { name }) : t.home_hello}</h1>
            <p className="mt-0.5 max-w-[16rem] text-sm font-medium text-ink/80 sm:max-w-sm">{t.home_ask}</p>
          </div>
        </div>
        <div aria-hidden="true" className="h-20 sm:h-28" />
      </section>

      {!signedIn && (
        <section className="flex flex-col gap-3 rounded-card border border-sky-line bg-sky p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-primary">{t.home_visitor_cta}</p>
          <NavRowLink href="/login" className={btnClass("primary", "shrink-0")}>{t.nav_signin}</NavRowLink>
        </section>
      )}

      <section aria-labelledby="h-traveler" className="space-y-3">
        <h2 id="h-traveler" className="px-1 text-sm font-bold uppercase tracking-wider text-muted">{t.home_section_traveler}</h2>
        <div className="grid grid-cols-2 gap-3">{render(traveler)}</div>
      </section>

      {admin.length > 0 && (
        <section aria-labelledby="h-admin" className="space-y-3 pt-2">
          <h2 id="h-admin" className="px-1 text-sm font-bold uppercase tracking-wider text-muted">{t.home_section_admin}</h2>
          <div className="grid grid-cols-2 gap-3">{render(admin)}</div>
        </section>
      )}
    </div>
  );
}

export const generateMetadata = async () => ({ alternates: alternatesOf("/", await getLang()) });
