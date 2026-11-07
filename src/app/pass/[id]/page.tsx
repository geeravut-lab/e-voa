import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { passToken } from "@/lib/passes";
import { SITE_URL } from "@/lib/env";
import { AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { PrintButton } from "@/components/PrintButton";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";

/** The traveler's E-VOA pass: name, reference, dates and a QR code. The QR is drawn into the page itself (no image request), so the pass still shows offline once opened. */
export default async function PassPage({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireUser("/pass");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { t, lang } = await getT();
  const db = await createClient();
  const { data: a } = await db.from("applications").select("id, ref_no, status, package, trip_id, traveler_id, immigration_ref").eq("id", id).eq("owner_id", v.user.id).in("status", ["approved", "used"]).maybeSingle();
  if (!a) notFound();
  const [{ data: trip }, { data: tr }, { data: evoa }] = await Promise.all([
    db.from("trips").select("arrival_date, arrival_time, arrival_flight_no").eq("id", a.trip_id).maybeSingle(),
    db.from("travelers").select("given_name, surname, passport_last4").eq("id", a.traveler_id).maybeSingle(),
    db.from("documents").select("id").eq("application_id", a.id).eq("kind", "evoa").is("deleted_at", null).limit(1).maybeSingle(),
  ]);
  const svg = await QRCode.toString(`${SITE_URL}/v/${passToken(a.id)}`, { type: "svg", margin: 1, width: 220, errorCorrectionLevel: "M" });
  const fmt = new Intl.DateTimeFormat(lang, { dateStyle: "long" });
  return (
    <div className="space-y-4">
      <div className="print:hidden"><PageHead title={t.card_pass} hint={t.pass_hint} art="pass" tone="sky" /></div>
      <article className="mx-auto max-w-sm space-y-3 rounded-card border-2 border-primary bg-surface p-5 text-center shadow-card print:shadow-none" aria-label={t.card_pass}>
        <p className="text-xs font-extrabold uppercase tracking-widest text-primary">{t.pass_title}</p>
        <p className="font-display text-2xl font-extrabold">{tr ? `${tr.given_name} ${tr.surname}` : a.ref_no}</p>
        <div className="mx-auto w-56 rounded-control bg-white p-1" role="img" aria-label={t.pass_qr_label} dangerouslySetInnerHTML={{ __html: svg }} />
        <dl className="grid grid-cols-2 gap-2 text-start text-sm">
          <div><dt className="text-xs text-muted">{t.pass_ref}</dt><dd className="font-mono font-bold">{a.ref_no}</dd></div>
          {a.immigration_ref && <div><dt className="text-xs text-muted">{t.pass_gov_ref}</dt><dd className="font-mono font-bold">{a.immigration_ref}</dd></div>}
          {trip && <div><dt className="text-xs text-muted">{t.apply_arrival_date}</dt><dd className="font-bold">{fmt.format(new Date(trip.arrival_date))}</dd></div>}
          {trip?.arrival_flight_no && <div><dt className="text-xs text-muted">{t.apply_flight_no}</dt><dd className="font-bold">{trip.arrival_flight_no}</dd></div>}
          {tr?.passport_last4 && <div><dt className="text-xs text-muted">{t.pass_passport_end}</dt><dd className="font-mono font-bold">••••{tr.passport_last4}</dd></div>}
        </dl>
        <p className="text-xs text-muted">{t.pass_offline_hint}</p>
      </article>
      <div className="mx-auto flex max-w-sm flex-wrap justify-center gap-2 print:hidden">
        <a href={`/pass/${a.id}/card`} download className={btnClass("gold")}>{t.pass_save}</a>
        <PrintButton />
        {evoa && <a href={`/api/documents/${evoa.id}`} target="_blank" rel="noopener" className={btnClass("ghost")}>{t.trip_download_evoa}</a>}
        <AppLink href={`/trips/${a.id}`} className={btnClass("ghost")}>{t.back}</AppLink>
      </div>
    </div>
  );
}
