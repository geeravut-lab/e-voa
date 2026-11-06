import { pageMeta } from "@/lib/seo";
import { requireFeaturePage } from "@/lib/flags";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";
import { DEFAULT_ADDON_RULES, parseAddonRules } from "@/lib/partners/rules";
import { AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";
export const generateMetadata = () => pageMeta({ path: "/extras", title: "card_extras", description: "seo_extras" });

export default async function ExtrasPage() {
  await requireFeaturePage("extras");
  const { t } = await getT();
  const [{ data }, rules] = await Promise.all([(await createClient()).from("partner_packages").select("package_code, category, name, detail, price_thb").eq("active", true).order("price_thb"), getSetting<unknown>("addon_rules", DEFAULT_ADDON_RULES).then(parseAddonRules)]);
  const cats = ["insurance", "esim", "sim", "vip", "health"] as const;
  const name: Record<string, string> = { insurance: t.extras_insurance, esim: t.extras_esim, sim: t.extras_sim, vip: t.extras_vip, health: t.extras_health };
  const note: Record<string, string | undefined> = { sim: rules.sim_blocked_for_express ? t.extras_not_with_express : undefined, vip: rules.vip_blocked_for_express ? t.extras_not_with_express : undefined };
  return (
    <div className="space-y-4">
      <PageHead title={t.card_extras} hint={t.card_extras_sub} art="extras" tone="mint" />
      {(data ?? []).length === 0 && <p className="rounded-card border border-line bg-surface p-5 text-center text-muted shadow-card">{t.extras_empty}</p>}
      {cats.map((c) => { const list = (data ?? []).filter((p) => p.category === c); if (!list.length) return null; return (
        <section key={c} className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">{name[c]}</h2>
          {note[c] && <p className="text-xs font-semibold text-gold-deep">{note[c]}</p>}
          <ul className="divide-y divide-line">{list.map((p) => <li key={p.package_code} className="flex items-start justify-between gap-3 py-2"><span className="min-w-0"><b className="block text-sm">{p.name}</b>{p.detail && <span className="block text-xs text-muted">{p.detail}</span>}</span><b className="tabular text-sm">THB {Number(p.price_thb).toLocaleString("en-US")}</b></li>)}</ul>
        </section>); })}
      <p className="text-sm text-muted">{t.extras_how}</p>
      <AppLink href="/apply" className={btnClass("gold", "w-full")}>{t.card_apply}</AppLink>
    </div>
  );
}
