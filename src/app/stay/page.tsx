import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { getViewer } from "@/lib/auth";
import { forLang } from "@/lib/content/types";
import { STAY } from "@/lib/content/toolkit";
import { createClient } from "@/lib/supabase/server";
import { loadRules } from "@/lib/rules/service";
import { daysLeft, stayEnd } from "@/lib/rules/rules";
import { PageHead } from "@/components/PageHead";
import { AppLink } from "@/components/AppLink";
import { StayCalculator } from "@/components/StayCalculator";
import { stayLineFor, TONE } from "@/lib/rules/stay-text";
import { btnClass } from "@/components/buttonStyles";

export const generateMetadata = () => pageMeta({ path: "/stay", title: "stay_title", description: "tk_stay_sub" });
export const dynamic = "force-dynamic";

export default async function StayPage() {
  const { t, lang } = await getT();
  const c = forLang(STAY, lang);
  const v = await getViewer();
  const cfg = await loadRules();
  const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card";
  let trips: { id: string; name: string; start: string; end: string; left: number }[] = [];
  if (v.user) {
    const db = await createClient();
    const { data } = await db.from("applications").select("id, traveler_id, trips(arrival_date)").eq("owner_id", v.user.id).in("status", ["approved", "used"]).limit(50);
    const ids = [...new Set((data ?? []).map((a) => a.traveler_id))];
    const { data: trs } = ids.length ? await db.from("travelers").select("id, given_name, surname").in("id", ids) : { data: [] };
    trips = (data ?? []).flatMap((a) => {
      const x = a.trips as { arrival_date: string } | { arrival_date: string }[] | null, start = (Array.isArray(x) ? x[0] : x)?.arrival_date;
      if (!start) return [];
      const tr = trs?.find((r) => r.id === a.traveler_id), end = stayEnd(start, cfg.stay_guard.stay_days);
      return [{ id: a.id, name: tr ? `${tr.given_name} ${tr.surname}` : "—", start, end, left: daysLeft(end, new Date()) }];
    }).sort((a, b) => a.end.localeCompare(b.end));
  }
  return (
    <div className="space-y-4">
      <PageHead title={t.stay_title} hint={c.intro} art="toolkit" tone="mint" />
      <section className={box}>
        <h2 className="font-display text-lg font-bold">{t.stay_trips}</h2>
        {!v.user ? <><p className="text-sm text-muted">{t.stay_signin}</p><AppLink href="/login?next=/stay" className={btnClass("primary")}>{t.nav_signin}</AppLink></>
          : trips.length === 0 ? <p className="text-sm text-muted">{t.stay_none}</p>
          : <ul className="space-y-2">{trips.map((x) => { const l = stayLineFor(t, x.left); return (
              <li key={x.id} className="rounded-control border border-line p-3"><b className="block">{x.name}</b>
                <span className="block text-sm text-muted tabular">{t.stay_from_trip}: {x.start} → {x.end}</span>
                <span className={`block font-display text-lg font-extrabold ${TONE[l.tone]}`}>{l.text}</span></li>); })}</ul>}
      </section>
      <section className={box}><h2 className="font-display text-lg font-bold">{t.stay_calc_title}</h2><StayCalculator defaultDays={cfg.stay_guard.stay_days} /></section>
      <section className={box}>
        <p className="text-[15px]">{c.how}</p>
        <p className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{c.stamp}</p>
        <p className="text-[15px]">{c.extend}</p>
        <p className="text-[15px] font-semibold text-danger">{c.overstay}</p>
      </section>
    </div>
  );
}
