import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { documentFiles, documentKinds, requiredDocuments } from "@/lib/applications/service";
import { reasonText, docLabel } from "@/lib/reasons";
import { decodeProblems } from "@/lib/applications/precheck";
import { AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { StatusBadge, statusHint } from "@/components/StatusBadge";
import { CancelPanel, ResubmitForm, UpgradeForm } from "@/components/TripActions";
import { upgradeQuote } from "@/lib/payments/service";
import { DocSlot } from "@/components/apply/DocSlot";
import { DocViewer } from "@/components/apply/DocViewer";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";

export default async function TripDetail({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireUser("/trips");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { t, lang } = await getT();
  const db = await createClient();
  const { data: a } = await db.from("applications").select("id, ref_no, status, status_reason, package, trip_id, traveler_id, payment_id, immigration_ref, sla_due_at, created_at, decided_at").eq("id", id).eq("owner_id", v.user.id).maybeSingle();
  if (!a) notFound();
  const [{ data: trip }, { data: tr }, { data: history }, { data: addons }, kinds, required, files] = await Promise.all([
    db.from("trips").select("arrival_date, arrival_time, arrival_flight_no, departure_date").eq("id", a.trip_id).maybeSingle(),
    db.from("travelers").select("given_name, surname").eq("id", a.traveler_id).maybeSingle(),
    db.from("application_status_history").select("to_status, reason, at").eq("application_id", a.id).order("at", { ascending: true }),
    db.from("addon_orders").select("id, category, package_name, status, price_thb, delivery, partner_ref, last_error").eq("application_id", a.id).neq("status", "cancelled").order("created_at"),
    documentKinds(a.id), requiredDocuments(), documentFiles(a.id),
  ]);
  const when = new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" });
  const problems = a.status === "action_required" ? decodeProblems(a.status_reason) : [];
  const fixable = a.status === "action_required";
  const canChange = a.status === "action_required" && !a.immigration_ref;
  const canCancel = ["paid", "pre_check", "action_required", "submission_failed"].includes(a.status);
  const upgrade = a.package === "regular" ? await upgradeQuote(a.id, v.user.id) : null;
  const { data: evoa } = a.status === "approved" || a.status === "used" ? await db.from("documents").select("id").eq("application_id", a.id).eq("kind", "evoa").is("deleted_at", null).limit(1).maybeSingle() : { data: null };
  return (
    <div className="space-y-4">
      <PageHead title={tr ? `${tr.given_name} ${tr.surname}` : a.ref_no} hint={a.ref_no} art="trips" tone="rose" />
      <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between gap-2"><StatusBadge status={a.status} t={t} />{a.sla_due_at && ["pre_check", "submitted", "under_review"].includes(a.status) && <span className="text-xs text-muted">{t.trip_decision_by} {when.format(new Date(a.sla_due_at))}</span>}</div>
        <p className="text-sm text-muted">{statusHint(t, a.status)}</p>
        {a.status_reason && ["rejected", "action_required", "submission_failed"].includes(a.status) && <p role="alert" className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{reasonText(t, a.status_reason)}</p>}
        {trip && <p className="text-sm tabular">{t.apply_arrival}: {trip.arrival_date} {trip.arrival_time ?? ""} {trip.arrival_flight_no ?? ""}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {(a.status === "approved" || a.status === "used") && <AppLink href={`/pass/${a.id}`} className={btnClass("gold")}>{t.trip_open_pass}</AppLink>}
          {["approved", "used", "rejected", "cancelled", "expired", "no_show"].includes(a.status) && <AppLink href={`/apply?again=${a.id}`} className={btnClass("primary")}>{t.apply_again}</AppLink>}
          {a.payment_id && <AppLink href={`/receipts/${a.payment_id}`} className={btnClass("ghost")}>{t.pay_see_receipt}</AppLink>}
          {evoa && <a href={`/api/documents/${evoa.id}`} target="_blank" rel="noopener" className={btnClass("ghost")}>{t.trip_download_evoa}</a>}
        </div>
      </section>

      {files.size > 0 && (
        <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">{t.trip_docs_title}</h2>
          <ul className="divide-y divide-line">{[...files].filter(([k]) => !["evoa", "signature"].includes(k)).map(([k, f]) => <li key={k} className="flex items-center justify-between gap-2 py-2 text-sm"><span className="font-semibold">{docLabel(t, k)}</span><DocViewer id={f.id} mime={f.mime} label={docLabel(t, k)} /></li>)}</ul>
        </section>
      )}

      {fixable && (
        <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">{t.trip_fix_title}</h2>
          <p className="text-sm text-muted">{t.trip_fix_hint}</p>
          {[...new Set([...problems.filter((p) => p.code === "missing_doc").map((p) => String(p.kind)), ...required.filter((k) => !kinds.includes(k) && k !== "insurance"), "additional"])].map((k) => <DocSlot key={k} appId={a.id} kind={k} have={kinds.includes(k)} file={files.get(k)} required={k !== "additional"} />)}
          <ResubmitForm appId={a.id} />
        </section>
      )}

      {(canChange || upgrade?.ok || canCancel) && (
        <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">{t.manage_title}</h2>
          {upgrade?.ok && <UpgradeForm appId={a.id} diffLabel={`THB ${upgrade.diffThb.toLocaleString("en-US")}`} />}
          {canChange && <AppLink href={`/trips/${a.id}/change`} className={btnClass("ghost", "w-full")}>{t.change_open}</AppLink>}
          {canCancel && <CancelPanel appId={a.id} />}
        </section>
      )}

      {(addons ?? []).length > 0 && (
        <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">{t.card_extras}</h2>
          <ul className="space-y-3">
            {addons!.map((x) => <AddonCard key={x.id} x={x} t={t} />)}
          </ul>
        </section>
      )}

      <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.trip_timeline}</h2>
        <ol className="space-y-2 border-l-2 border-sky-line ps-4">
          {(history ?? []).map((h, i) => (
            <li key={i} className="text-sm"><b>{(t as unknown as Record<string, string>)[`st_${h.to_status}`] ?? h.to_status}</b> <span className="text-muted tabular">· {when.format(new Date(h.at))}</span></li>
          ))}
        </ol>
      </section>
    </div>
  );
}

type Addon = { id: string; category: string; package_name: string; status: string; price_thb: number | string; delivery: Record<string, unknown> | null; partner_ref: Record<string, unknown> | null; last_error: string | null };
function AddonCard({ x, t }: { x: Addon; t: import("@/lib/i18n/dict").Dict }) {
  const d = (x.delivery ?? {}) as Record<string, unknown>, p = (x.partner_ref ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const url = (v: unknown) => (typeof v === "string" && /^https?:\/\//.test(v) ? v : undefined);
  const label = (t as unknown as Record<string, string>)[`addon_st_${x.status}`] ?? x.status;
  const link = (u: string | undefined, text: string) => (u ? <a href={u} target="_blank" rel="noopener noreferrer" className="block font-semibold text-primary underline">{text}</a> : null);
  const result = (d.result ?? null) as { result?: string; url?: string } | null;
  const qr = url(d.esim_qr_url);
  return (
    <li className="space-y-1 rounded-control border border-line p-3 text-sm">
      <div className="flex items-center justify-between gap-2"><b>{x.package_name}</b><span className={`text-xs font-extrabold ${x.status === "failed" ? "text-danger" : x.status === "issued" || x.status === "used" ? "text-success" : "text-gold-deep"}`}>{label}</span></div>
      {(x.status === "issued" || x.status === "used") && (
        <div className="space-y-1">
          {str(p.policy_no) && <p className="tabular">{t.addon_policy_no}: <b className="font-mono">{str(p.policy_no)}</b></p>}
          {link(url(d.ecard_url) ?? url(d.policy_url), t.addon_open_ecard)}
          {str(d.voucher_code) && <p className="tabular">{t.addon_voucher}: <b className="font-mono">{str(d.voucher_code)}</b></p>}
          {link(url(d.voucher_url), t.addon_open_voucher)}
          {qr && /* eslint-disable-next-line @next/next/no-img-element */ <img src={qr} alt={t.addon_qr} width={160} height={160} className="rounded-control border border-line" />}
          {str(d.esim_lpa) && <p className="break-all font-mono text-xs">{t.addon_lpa}: {str(d.esim_lpa)}</p>}
          {str(d.pickup) && <p className="text-muted">{t.addon_pickup}</p>}
          {result?.result && <p>{t.addon_result}: <b>{result.result}</b></p>}
          {link(url(result?.url), t.addon_open_result)}
        </div>
      )}
      {x.status === "failed" && <p className="text-muted">{t.addon_failed_hint}</p>}
    </li>
  );
}
