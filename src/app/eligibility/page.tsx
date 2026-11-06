import { requireFeaturePage } from "@/lib/flags";
import { getT } from "@/lib/i18n/server";
import { loadMaster } from "@/lib/master";
import { getSetting } from "@/lib/settings";
import { checkEligibility, parseEligibility } from "@/lib/eligibility";
import { AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { GetForm } from "@/components/GetForm";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check eligibility", description: "Find out whether your nationality can apply for the Thailand Visa on Arrival (e-VOA)." };

/** "Do I need a visa?" The answer uses only the lists the admin entered from the official source; with no list it says so instead of guessing. */
export default async function EligibilityPage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  await requireFeaturePage("eligibility");
  const { t } = await getT();
  const sp = await searchParams;
  const [nats, cfg] = await Promise.all([loadMaster("nationality"), getSetting<unknown>("eligibility", { voa: [], visa_free: [] }).then(parseEligibility)]);
  const chosen = sp.n ? nats.find((r) => String(r.id) === sp.n) : undefined;
  const code = chosen ? String((chosen.extra as { CountryCode?: string }).CountryCode ?? "") : null;
  const res = chosen ? checkEligibility(code, cfg) : null;
  const msg = { voa: t.elig_voa, visa_free: t.elig_visa_free, other: t.elig_other, unknown: t.elig_unknown } as const;
  return (
    <div className="space-y-4">
      <PageHead title={t.card_check} hint={t.card_check_sub} art="check" tone="sky" />
      <GetForm label={t.apply_nationality} name="n" placeholder={t.choose} options={nats.map((r) => ({ id: r.id, label: r.label }))} value={sp.n ?? ""} submit={t.elig_check} />
      {res && (
        <section role="status" className={`space-y-3 rounded-card border p-5 shadow-card ${res === "voa" ? "border-success bg-mint" : "border-line bg-surface"}`}>
          <p className="font-display text-lg font-bold">{chosen!.label}</p>
          <p>{msg[res]}</p>
          {res === "voa" && <AppLink href="/apply" className={btnClass("gold", "w-full")}>{t.card_apply}</AppLink>}
          <p className="text-xs text-muted">{t.elig_disclaimer}</p>
        </section>
      )}
    </div>
  );
}
