import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AppLink, NavRowLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { StatusBadge } from "@/components/StatusBadge";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const v = await requireUser("/trips");
  const { t, lang } = await getT();
  const db = await createClient();
  const { data: apps } = await db.from("applications").select("id, ref_no, status, package, trip_id, traveler_id, created_at").eq("owner_id", v.user.id).order("created_at", { ascending: false }).limit(100);
  const tripIds = [...new Set((apps ?? []).map((a) => a.trip_id))], trIds = [...new Set((apps ?? []).map((a) => a.traveler_id))];
  const [{ data: trips }, { data: trs }] = await Promise.all([
    tripIds.length ? db.from("trips").select("id, arrival_date, arrival_flight_no").in("id", tripIds) : { data: [] },
    trIds.length ? db.from("travelers").select("id, given_name, surname").in("id", trIds) : { data: [] },
  ]);
  const fmt = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });
  return (
    <div className="space-y-4">
      <PageHead title={t.card_trips} hint={t.trips_hint} art="trips" tone="rose" />
      {(apps ?? []).length === 0 ? (
        <section className="space-y-3 rounded-card border border-line bg-surface p-5 text-center shadow-card">
          <p className="text-muted">{t.trips_empty}</p>
          <AppLink href="/apply" className={btnClass("gold")}>{t.card_apply}</AppLink>
        </section>
      ) : (
        <ul className="space-y-3">
          {apps!.map((a) => {
            const trip = trips?.find((x) => x.id === a.trip_id), tr = trs?.find((x) => x.id === a.traveler_id);
            const resume = a.status === "draft" || a.status === "awaiting_payment";
            return (
              <li key={a.id}>
                <NavRowLink href={resume ? `/apply?step=4&trip=${a.trip_id}` : `/trips/${a.id}`} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{tr ? `${tr.given_name} ${tr.surname}` : a.ref_no}</b>
                    <span className="block text-sm text-muted tabular">{a.ref_no} · {trip ? fmt.format(new Date(trip.arrival_date)) : ""} {trip?.arrival_flight_no ? `· ${trip.arrival_flight_no}` : ""}</span>
                  </span>
                  <StatusBadge status={a.status} t={t} />
                </NavRowLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
