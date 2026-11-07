import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { getViewer } from "@/lib/auth";
import { forLang } from "@/lib/content/types";
import { TDAC, TDAC_URL } from "@/lib/content/toolkit";
import { createClient } from "@/lib/supabase/server";
import { PageHead } from "@/components/PageHead";
import { OutLink } from "@/components/OutLink";

export const generateMetadata = () => pageMeta({ path: "/tdac", title: "tdac_title", description: "tk_tdac_sub" });
export const dynamic = "force-dynamic";
const addDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export default async function TdacPage() {
  const { t, lang } = await getT();
  const c = forLang(TDAC, lang);
  const v = await getViewer();
  let trip: string | null = null;
  if (v.user) {
    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    const { data } = await (await createClient()).from("applications").select("status, trips(arrival_date)").eq("owner_id", v.user.id).in("status", ["approved", "paid", "pre_check", "submitted", "under_review", "action_required"]).limit(20);
    const dates = (data ?? []).map((a) => { const x = a.trips as { arrival_date: string } | { arrival_date: string }[] | null; return (Array.isArray(x) ? x[0] : x)?.arrival_date ?? ""; }).filter((d) => d >= today).sort();
    trip = dates[0] ?? null;
  }
  const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card";
  return (
    <div className="space-y-4">
      <PageHead title={t.tdac_title} hint={c.intro} art="toolkit" tone="sky" />
      {trip && <p role="status" className="rounded-control bg-sky p-3 text-sm font-semibold text-primary">{t.tdac_window.replaceAll("{date}", trip).replace("{from}", addDays(trip, -3))}</p>}
      <section className={box}><h2 className="font-display text-lg font-bold">{t.tdac_steps}</h2><ol className="list-decimal space-y-2 ps-5 text-[15px]">{c.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <OutLink href={TDAC_URL} variant="gold">{t.tdac_open}</OutLink><p className="break-all text-xs text-muted">{TDAC_URL}</p></section>
      <section className={`${box} border-gold`}><h2 className="font-display text-lg font-bold">{t.tdac_beware}</h2><ul className="list-disc space-y-1 ps-5 text-[15px]">{c.warn.map((s) => <li key={s}>{s}</li>)}</ul></section>
      <p className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{c.note}</p>
    </div>
  );
}
