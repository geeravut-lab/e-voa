import { NAV, resolveHref } from "@/config/nav";
import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { HomeCard } from "@/components/HomeCard";
import { PageHead } from "@/components/PageHead";

export default async function AdminHome() {
  await requireAdminPage();
  const { t } = await getT();
  const items = NAV.filter((n) => n.area === "admin" && n.home);
  return (
    <div>
      <PageHead title={t.admin_title} hint={t.admin_only_hint} tone="gold" />
      <div className="grid grid-cols-2 gap-3">
        {items.map((n) => (
          <HomeCard key={n.key} item={n} href={resolveHref(n, true)} label={t[n.label]} sub={n.sub ? t[n.sub] : undefined} locked={false} lockedLabel={t.home_locked} />
        ))}
      </div>
    </div>
  );
}
