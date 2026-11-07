import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reasonText, docLabel } from "@/lib/reasons";
import { PageHead } from "@/components/PageHead";
import { StatusBadge } from "@/components/StatusBadge";
import { simulatorActive } from "@/lib/immigration/resolve";
import { isSimulatedRef } from "@/lib/immigration/simulator";
import { SimulateDecision } from "@/components/SimulateDecision";
import { NoteForm, RequestFixForm, RetrySendForm, CancelForm, RefundExceptionForm, AddonOpsForms } from "@/components/OpsForms";

export const dynamic = "force-dynamic";

export default async function QueueDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdminPage(["ops", "finance"]);                  // first line: hiding the menu is not access control
  const ops = viewer.caps.includes("ops"), fin = viewer.caps.includes("finance");   // what this role may do on the page (the actions check again)
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { t, lang } = await getT();
  const db = createAdminClient();
  const { data: a } = await db.from("applications").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  const [{ data: tr }, { data: trip }, { data: history }, { data: docs }, { data: notes }, { data: addons }, { data: pay }, { data: outbox }, { data: decl }, { data: cons }] = await Promise.all([
    db.from("travelers").select("given_name, surname, passport_last4, nationality_id, email, phone").eq("id", a.traveler_id).maybeSingle(),
    db.from("trips").select("arrival_date, arrival_time, arrival_flight_no, departure_date").eq("id", a.trip_id).maybeSingle(),
    db.from("application_status_history").select("from_status, to_status, reason, source, at").eq("application_id", a.id).order("at"),
    db.from("documents").select("id, kind, mime, created_at").eq("application_id", a.id).is("deleted_at", null).order("created_at"),
    db.from("application_notes").select("id, body, created_at").eq("application_id", a.id).order("created_at", { ascending: false }),
    db.from("addon_orders").select("id, package_name, category, status, price_thb, refunded_thb, last_error, attempts").eq("application_id", a.id).neq("status", "cancelled"),
    a.payment_id ? db.from("payments").select("id, receipt_no, status, amount_thb, refunded_thb, paid_at").eq("id", a.payment_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("immigration_outbox").select("status, attempts, last_error, next_attempt_at").eq("application_id", a.id).order("created_at", { ascending: false }).limit(1),
    db.from("declarations").select("signer_name, version, signed_at").eq("application_id", a.id).maybeSingle(),
    db.from("consents").select("kind, version").eq("application_id", a.id),
  ]);
  const when = new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" });
  const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card";
  const st = a.status as string;
  const canSimulate = ops && ["submitted", "under_review"].includes(st) && isSimulatedRef(a.immigration_ref) && (await simulatorActive());
  const canFix = ["pre_check", "submitted", "under_review"].includes(st), canRetry = st === "submission_failed", canCancel = ["draft", "awaiting_payment", "paid", "pre_check", "action_required", "submission_failed"].includes(st);
  const refundable = pay && ["paid", "partially_refunded"].includes(pay.status) ? Number(pay.amount_thb) - Number(pay.refunded_thb) : 0;
  return (
    <div className="space-y-4">
      <PageHead title={tr ? `${tr.given_name} ${tr.surname}` : a.ref_no} hint={a.ref_no} art="ops" tone="gold" />
      <section className={box}>
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={st} t={t} /><span className="text-sm text-muted">{a.package === "express" ? t.apply_pkg_express : t.apply_pkg_regular}</span>{a.sla_due_at && <span className="text-sm text-muted tabular">{t.ops_due} {when.format(new Date(a.sla_due_at))}</span>}</div>
        {a.status_reason && <p className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{reasonText(t, a.status_reason)}</p>}
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {tr?.email && <div><dt className="text-xs text-muted">{t.apply_email}</dt><dd className="break-all">{tr.email}</dd></div>}
          {tr?.passport_last4 && <div><dt className="text-xs text-muted">{t.pass_passport_end}</dt><dd className="font-mono">••••{tr.passport_last4}</dd></div>}
          {trip && <div><dt className="text-xs text-muted">{t.apply_arrival_date}</dt><dd className="tabular">{trip.arrival_date} {trip.arrival_time ?? ""} {trip.arrival_flight_no ?? ""}</dd></div>}
          {a.immigration_ref && <div><dt className="text-xs text-muted">{t.pass_gov_ref}</dt><dd className="font-mono">{a.immigration_ref}</dd></div>}
        </dl>
        {outbox?.[0] && <p className="text-xs text-muted">{t.ops_outbox}: {outbox[0].status} · {outbox[0].attempts}{outbox[0].last_error ? ` · ${outbox[0].last_error}` : ""}</p>}
      </section>

      {canSimulate && (
        <section className={`${box} border-gold`}>
          <h2 className="font-display text-lg font-bold">{t.ops_sim_title}</h2>
          <p className="text-sm text-muted">{t.ops_sim_hint}</p>
          <SimulateDecision appId={a.id} />
        </section>
      )}

      {ops && <section className={box}>
        <h2 className="font-display text-lg font-bold">{t.ops_actions}</h2>
        <p className="text-xs text-muted">{t.ops_decisions_note}</p>
        {canRetry && <RetrySendForm appId={a.id} />}
        {canFix && <RequestFixForm appId={a.id} />}
        {canCancel && <CancelForm appId={a.id} />}
        {!canRetry && !canFix && !canCancel && <p className="text-sm text-muted">{t.ops_no_actions}</p>}
      </section>}

      {ops && <section className={box}>
        <h2 className="font-display text-lg font-bold">{t.ops_documents}</h2>
        <ul className="divide-y divide-line text-sm">
          {(docs ?? []).map((d) => <li key={d.id} className="flex items-center justify-between gap-2 py-2"><span>{docLabel(t, d.kind)} <span className="text-muted">· {d.mime}</span></span><a href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="font-semibold text-primary underline">{t.ops_open}</a></li>)}
          {(docs ?? []).length === 0 && <li className="py-2 text-muted">{t.ops_none}</li>}
        </ul>
        <p className="text-xs text-muted">{t.ops_docs_audited}</p>
      </section>}

      <section className={box}>
        <h2 className="font-display text-lg font-bold">{t.consent_title}</h2>
        {decl ? <p className="text-sm tabular">✓ {t.declare_title}: {decl.signer_name} · {when.format(new Date(decl.signed_at))} · v {decl.version}</p> : <p className="text-sm text-muted">{t.ops_none}</p>}
        {(cons ?? []).length > 0 && <p className="text-xs text-muted">{(cons ?? []).map((c) => c.kind).join(" · ")}</p>}
      </section>

      {pay && (
        <section className={box}>
          <h2 className="font-display text-lg font-bold">{t.receipt_title}</h2>
          <p className="text-sm tabular">{pay.receipt_no ?? "—"} · THB {Number(pay.amount_thb).toLocaleString("en-US")} · {pay.status}{Number(pay.refunded_thb) > 0 ? ` · −${Number(pay.refunded_thb).toLocaleString("en-US")}` : ""}</p>
          {fin && refundable > 0 && <RefundExceptionForm appId={a.id} paymentId={pay.id} max={refundable} />}
        </section>
      )}

      {(addons ?? []).length > 0 && (
        <section className={box}>
          <h2 className="font-display text-lg font-bold">{t.card_extras}</h2>
          <ul className="space-y-3">{addons!.map((x) => (
            <li key={x.id} className="space-y-2 rounded-control border border-line p-3 text-sm"><p className="flex justify-between gap-2"><b>{x.package_name}</b><span className="tabular">THB {Number(x.price_thb).toLocaleString("en-US")} · {x.status}</span></p>
              {x.last_error && <p className="text-xs text-danger">{x.last_error}</p>}<AddonOpsForms appId={a.id} orderId={x.id} status={x.status} /></li>))}</ul>
        </section>
      )}

      {ops && <section className={box}>
        <h2 className="font-display text-lg font-bold">{t.ops_notes}</h2>
        <NoteForm appId={a.id} />
        <ul className="space-y-2 text-sm">{(notes ?? []).map((n) => <li key={n.id} className="rounded-control bg-sand p-3"><p className="whitespace-pre-wrap">{n.body}</p><p className="text-xs text-muted tabular">{when.format(new Date(n.created_at))}</p></li>)}</ul>
        <p className="text-xs text-muted">{t.ops_notes_hint}</p>
      </section>}

      <section className={box}>
        <h2 className="font-display text-lg font-bold">{t.trip_timeline}</h2>
        <ol className="space-y-2 border-l-2 border-sky-line ps-4 text-sm">{(history ?? []).map((h, i) => <li key={i}><b>{(t as unknown as Record<string, string>)[`st_${h.to_status}`] ?? h.to_status}</b> <span className="text-muted tabular">· {h.source} · {when.format(new Date(h.at))}</span>{h.reason && <span className="block text-xs text-muted">{reasonText(t, h.reason)}</span>}</li>)}</ol>
      </section>
    </div>
  );
}
