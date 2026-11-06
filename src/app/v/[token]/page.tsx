import { getT } from "@/lib/i18n/server";
import { verifyPassToken } from "@/lib/passes";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRole } from "@/lib/env";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** What a QR scan shows. Public, but only with a valid signature, and only the minimum: status, first name + initial, arrival date. */
export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const { t } = await getT();
  const id = hasServiceRole() ? verifyPassToken(decodeURIComponent(token)) : null;
  let row: { status: string; ref_no: string; given: string; sur: string; arrival: string | null } | null = null;
  if (id) {
    const db = createAdminClient();
    const { data: a } = await db.from("applications").select("status, ref_no, trip_id, traveler_id").eq("id", id).maybeSingle();
    if (a) {
      const [{ data: tr }, { data: trip }] = await Promise.all([db.from("travelers").select("given_name, surname").eq("id", a.traveler_id).maybeSingle(), db.from("trips").select("arrival_date").eq("id", a.trip_id).maybeSingle()]);
      row = { status: a.status, ref_no: a.ref_no, given: tr?.given_name ?? "", sur: tr?.surname ?? "", arrival: trip?.arrival_date ?? null };
    }
  }
  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="font-display text-2xl font-extrabold">{t.verify_title}</h1>
      {!row ? <p role="alert" className="rounded-card bg-rose p-5 font-semibold text-danger">✕ {t.verify_invalid}</p> : (
        <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
          <StatusBadge status={row.status} t={t} />
          <p className="font-display text-xl font-bold">{row.given} {row.sur.slice(0, 1)}.</p>
          <p className="font-mono">{row.ref_no}</p>
          {row.arrival && <p className="tabular text-sm">{t.apply_arrival_date}: {row.arrival}</p>}
          <p className="text-xs text-muted">{t.verify_note}</p>
        </section>
      )}
    </main>
  );
}
