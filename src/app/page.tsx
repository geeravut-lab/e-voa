import { redirect } from "next/navigation";
import { alternatesOf } from "@/lib/seo";
import { getLang } from "@/lib/i18n/server";
import { NAV, packCards, resolveHref, spreadTones } from "@/config/nav";
import { getViewer, displayNameOf } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { loadFlags } from "@/lib/flags";
import { fmt } from "@/lib/i18n/dict";
import { HomeCard } from "@/components/HomeCard";
import { GreetingCard } from "@/components/GreetingCard";
import { NavRowLink } from "@/components/AppLink";
import { btnClass } from "@/components/buttonStyles";

export default async function HomePage() {
  const [viewer, { t, brand }, flags] = await Promise.all([getViewer(), getT(), loadFlags()]);
  if (viewer.isAdmin) redirect("/admin");                // staff work in the back office only
  const signedIn = !!viewer.user;
  const name = displayNameOf(viewer);
  const cards = NAV.filter((n) => n.home && (!n.feature || flags[n.feature]) && (!n.viewerOnly || viewer.isReportViewer) && (n.area === "traveler" || viewer.isAdmin));
  // Visitors do not need "notifications" and "account" cards; they see a sign-in banner instead.
  const traveler = cards.filter((n) => n.area === "traveler" && (signedIn || !["notifications", "account"].includes(n.key)));
  const admin = cards.filter((n) => n.area === "admin");

  const render = (raw: typeof cards) => {
    const list = packCards(raw);                    // no half-width card is left alone in a row
    const tones = spreadTones(list);
    return list.map((n) => (
      <HomeCard
        key={n.key}
        tone={tones.get(n.key)}
        item={n}
        href={resolveHref(n, signedIn)}
        label={t[n.label]}
        sub={n.sub ? t[n.sub] : undefined}
        locked={n.auth && !signedIn}
        lockedLabel={t.home_locked}
      />
    ));
  };

  return (
    <div className="space-y-4">
      <GreetingCard title={signedIn && name ? fmt(t.home_hello_name, { name }) : t.home_hello} subtitle={t.home_ask} />

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
