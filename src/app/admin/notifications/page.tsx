import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { attentionItems } from "@/lib/admin-attention";
import { fmt } from "@/lib/i18n/dict";
import { NavRowLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

export default async function AdminNotifications() {
  await requireAdminPage();
  const { t } = await getT();
  const items = await attentionItems();
  const text = (k: string) => (t as unknown as Record<string, string>)[k];
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_notif_title} hint={t.admin_notif_hint} art="notifications" tone="sand" />
      {items.length === 0 ? (
        <p role="status" className="rounded-card border border-line bg-mint p-5 font-semibold text-teal-deep">✓ {t.admin_notif_empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.key}>
              <NavRowLink href={i.href} className={`flex items-center gap-3 rounded-card border p-4 shadow-card ${i.severity === "high" ? "border-danger bg-rose" : "border-line bg-sky"}`}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${i.severity === "high" ? "bg-danger" : "bg-lotus"}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <b className="block">{fmt(text(`an_${i.key}`), { n: String(i.count) })}</b>
                  <span className="block text-sm text-muted">{text(`an_${i.key}_hint`)}</span>
                  {i.refs && i.refs.length > 0 && <span className="mt-1 block text-xs tabular text-muted">{i.refs.join(" · ")}{i.count > i.refs.length ? " …" : ""}</span>}
                </span>
                <span className="shrink-0 rounded-full bg-surface px-3 py-1 text-sm font-extrabold tabular">{i.count}</span>
              </NavRowLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
