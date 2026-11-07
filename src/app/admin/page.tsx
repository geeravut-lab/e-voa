import { NAV, packCards, resolveHref, spreadTones } from "@/config/nav";
import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { HomeCard } from "@/components/HomeCard";
import { GreetingCard } from "@/components/GreetingCard";
import { getViewer, displayNameOf } from "@/lib/auth";
import { fmt } from "@/lib/i18n/dict";

export default async function AdminHome() {
  await requireAdminPage();
  const { t } = await getT();
  const viewer = await getViewer(); const name = displayNameOf(viewer);
  const items = packCards(NAV.filter((n) => n.area === "admin" && n.home));            // no half-width card is left alone in a row
  const tones = spreadTones(items);
  return (
    <div>
      <div className="mb-5"><GreetingCard title={name ? fmt(t.home_hello_name, { name }) : t.home_hello} subtitle={t.admin_only_hint} /></div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((n) => (
          <HomeCard key={n.key} item={n} tone={tones.get(n.key)} href={resolveHref(n, true)} label={t[n.label]} sub={n.sub ? t[n.sub] : undefined} locked={false} lockedLabel={t.home_locked} />
        ))}
      </div>
    </div>
  );
}
