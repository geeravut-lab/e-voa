import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { getSetting } from "@/lib/settings";
import { loadFees } from "@/lib/applications/service";
import { applicationFees, REGULAR_MIN_HOURS, EXPRESS_MIN_HOURS } from "@/lib/pricing";
import { DEFAULT_REFUND_POLICY, parseRefundPolicy } from "@/lib/payments/refund-policy";
import { AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";
export const generateMetadata = () => pageMeta({ path: "/fees", title: "card_fees", description: "seo_fees" });
const thb = (n: number) => `THB ${n.toLocaleString("en-US")}`;

/** Prices and the refund rule, shown before anybody pays. Every number comes from the settings the admin edits. */
export default async function FeesPage() {
  const { t } = await getT();
  const [fees, policy] = await Promise.all([loadFees(), getSetting<unknown>("refund_policy", DEFAULT_REFUND_POLICY).then(parseRefundPolicy)]);
  const rows = (["regular", "express"] as const).map((p) => ({ p, f: applicationFees(fees, p) }));
  return (
    <div className="space-y-4">
      <PageHead title={t.card_fees} hint={t.card_fees_sub} art="fees" tone="gold" />
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        {rows.map(({ p, f }) => (
          <div key={p} className="rounded-control border border-line p-4">
            <p className="flex items-baseline justify-between gap-2"><b className="font-display text-lg">{p === "regular" ? t.apply_pkg_regular : t.apply_pkg_express}</b><b className="tabular text-lg">{thb(f.total)}</b></p>
            <p className="text-sm text-muted">{p === "regular" ? t.apply_pkg_regular_sub : t.apply_pkg_express_sub}</p>
            <p className="text-xs text-muted tabular">{t.apply_price_split.replace("{visa}", f.visa.toLocaleString("en-US")).replace("{service}", f.service.toLocaleString("en-US"))}</p>
            <p className="text-xs text-muted">{(p === "regular" ? t.fees_order_before : t.fees_order_before).replace("{hours}", String(p === "regular" ? REGULAR_MIN_HOURS : EXPRESS_MIN_HOURS))}</p>
          </div>
        ))}
        <p className="text-sm text-muted">{t.fees_per_person}</p>
      </section>
      <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.fees_refund_title}</h2>
        <p className="text-sm">{policy.visa_fee_refundable ? t.refund_visa_yes : t.refund_visa_no}</p>
        <p className="text-sm">{policy.unused_addons_refundable ? t.refund_addons_yes : t.refund_addons_no}</p>
        <p className="text-sm text-muted">{t.fees_provider_note}</p>
      </section>
      <AppLink href="/apply" className={btnClass("gold", "w-full")}>{t.card_apply}</AppLink>
    </div>
  );
}
