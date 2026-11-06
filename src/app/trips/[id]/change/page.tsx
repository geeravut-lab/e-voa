import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadMasters } from "@/lib/master";
import { loadFees } from "@/lib/applications/service";
import { flightLookupConfigured } from "@/lib/flights";
import { PageHead } from "@/components/PageHead";
import { TripForm } from "@/components/apply/TripForm";

export const dynamic = "force-dynamic";
const opts = (rows: { id: number; label: string }[]) => rows.map((r) => ({ id: r.id, label: r.label }));

/** Change the travel dates / flight of an application that needs action (nothing has been sent to Immigration yet). The package stays; to go faster use Upgrade. */
export default async function ChangeTrip({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireUser("/trips");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { t } = await getT();
  const db = await createClient();
  const { data: a } = await db.from("applications").select("id, trip_id, status, package, immigration_ref").eq("id", id).eq("owner_id", v.user.id).maybeSingle();
  if (!a || a.status !== "action_required" || a.immigration_ref) notFound();
  const { data: trip } = await db.from("trips").select("*").eq("id", a.trip_id).eq("owner_id", v.user.id).maybeSingle();
  if (!trip) notFound();
  const [m, fees] = await Promise.all([loadMasters(["arrivalAirport", "airlines", "purposeOfVisit", "nationality"]), loadFees()]);
  return (
    <div className="space-y-4">
      <PageHead title={t.change_title} hint={t.change_hint} art="trips" tone="rose" />
      <TripForm lockedPackage={a.package as "regular" | "express"} trip={trip} airports={opts(m.arrivalAirport)} airlines={opts(m.airlines)} purposes={opts(m.purposeOfVisit)} countries={opts(m.nationality)} fees={fees} canLookup={flightLookupConfigured()} />
    </div>
  );
}
