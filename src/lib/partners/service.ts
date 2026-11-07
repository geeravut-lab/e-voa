import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { decryptBytes, decryptText } from "@/lib/crypto";
import { getSetting } from "@/lib/settings";
import { DICTS, fmt } from "@/lib/i18n/dict";
import { isLang, type Lang } from "@/lib/i18n/langs";
import { saveDocument } from "@/lib/documents";
import { DOC_LIST_ID, runPreCheck } from "@/lib/applications/service";
import { partnerCall, listPackages, PartnerError, partnerBase, partnerConfigured, type Provider } from "./client";
import { issueViaPortal } from "@/lib/partner-portal/service";
import { addonOffer, parseAddonRules, DEFAULT_ADDON_RULES, providerOf, type AddonCategory } from "./rules";

const admin = () => createAdminClient();
const MAX_ATTEMPTS = 5;
const BACKOFF_MIN = [2, 10, 30, 120];

// ------------------------------------------------------------------ catalogue
const INSURANCE_DEFAULT = { plan_code: "GTA0501", name: "Travel accident and medical cover", price_thb: 290, price_usd: 8, price_cny: 58 };

/** Copies what the partners sell into partner_packages (the wizard reads this copy). One partner failing never blocks the others. */
export async function syncPartnerPackages(): Promise<{ rows: number; failed: Provider[] }> {
  const db = admin(); let rows = 0; const failed: Provider[] = [];
  const upsert = async (provider: Provider, category: AddonCategory, list: { code: string; name: string; detail?: string | null; thb: number; usd?: number | null; cny?: number | null; terms?: string | null; link?: string | null; image?: string | null }[]) => {
    if (list.length === 0) return;
    const r = await db.from("partner_packages").upsert(list.map((x) => ({ provider, package_code: x.code, category, name: x.name.slice(0, 200), detail: x.detail ?? null, price_thb: x.thb, price_usd: x.usd ?? null, price_cny: x.cny ?? null, terms: x.terms ?? null, ref_link: x.link ?? null, image: x.image ?? null, active: true, synced_at: new Date().toISOString() })), { onConflict: "provider,package_code" }).select("package_code");
    if (r.error) throw new Error(r.error.message);
    rows += list.length;
    const keep = list.map((x) => x.code);
    await db.from("partner_packages").update({ active: false }).eq("provider", provider).eq("source", "api").eq("category", category).not("package_code", "in", `(${keep.map((k) => `"${k}"`).join(",")})`);
  };
  const ins = { ...INSURANCE_DEFAULT, ...(await getSetting<Record<string, unknown>>("insurance", INSURANCE_DEFAULT)) } as typeof INSURANCE_DEFAULT;
  // A partner that is not connected must not be offered: the traveler would pay for something we cannot issue.
  const hide = (provider: Provider) => db.from("partner_packages").update({ active: false }).eq("provider", provider).eq("source", "api");          // packages typed in by a portal partner are not ours to hide
  if (partnerConfigured("insurance")) await upsert("insurance", "insurance", [{ code: ins.plan_code, name: ins.name, thb: Number(ins.price_thb), usd: Number(ins.price_usd), cny: Number(ins.price_cny) }]);   // CIS has no package list API: the plan lives in the settings
  else { await hide("insurance"); failed.push("insurance"); }
  for (const [provider, category] of [["sim", "sim"], ["sim", "esim"], ["vip", "vip"], ["bhs", "health"]] as const) {
    if (!partnerConfigured(provider)) { await hide(provider); if (!failed.includes(provider)) failed.push(provider); continue; }
    try {
      const pk = await listPackages(provider, category);
      await upsert(provider, category, pk.map((x) => ({ code: x.package_code, name: x.package_name, detail: x.package_detail, thb: Number(x.package_price_thb), usd: x.package_price_usd ? Number(x.package_price_usd) : null, cny: x.package_price_cny ? Number(x.package_price_cny) : null, terms: x.terms_of_use, link: x.ref_link, image: x.package_image })));
    } catch (e) { console.error(`[partners] package sync failed for ${provider}/${category}:`, (e as Error).message); if (!failed.includes(provider)) failed.push(provider); }
  }
  return { rows, failed };
}

/** Add-ons that may be offered for a trip right now (rules + stock + what is in the catalogue). `exceptApplicationId`: that application's own unpaid picks do not count against the stock. */
export async function offersFor(tripPackage: "regular" | "express", arrivalAirportId: number | null, exceptApplicationId?: string) {
  const rules = parseAddonRules(await getSetting<unknown>("addon_rules", DEFAULT_ADDON_RULES));
  const { data } = await admin().from("partner_packages").select("provider, package_code, category, name, detail, price_thb, price_usd, terms, partner_id, stock_total, partners(status)").eq("active", true).order("price_thb");
  const rows = (data ?? []).filter((p) => !p.partner_id || (p.partners as unknown as { status: string } | null)?.status === "active");
  const left = await stockLeft(rows.filter((p) => p.stock_total !== null).map((p) => ({ package_code: p.package_code, stock_total: p.stock_total as number })), exceptApplicationId);
  return rows.map((p) => {
    const remaining = p.stock_total === null ? null : left.get(p.package_code) ?? 0;
    const base = addonOffer(p.category as AddonCategory, { arrivalAirportId, package: tripPackage }, rules);
    return { ...p, price_thb: Number(p.price_thb), stock_left: remaining, offer: base.available && remaining !== null && remaining <= 0 ? ({ available: false, reason: "stock" } as const) : base };
  });
}

/** What is left of limited packages: the limit minus paid / issued / used orders and unpaid orders made in the last 2 hours (they hold a unit while the traveler pays). */
export async function stockLeft(pkgs: { package_code: string; stock_total: number }[], exceptApplicationId?: string): Promise<Map<string, number>> {
  const out = new Map<string, number>(); if (pkgs.length === 0) return out;
  const since = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const { data } = await admin().from("addon_orders").select("package_code, status, created_at, application_id").in("package_code", pkgs.map((p) => p.package_code)).in("status", ["pending_payment", "paid", "issuing", "issued", "used"]);
  for (const p of pkgs) {
    const taken = (data ?? []).filter((o) => o.package_code === p.package_code && (o.status !== "pending_payment" || (o.created_at > since && o.application_id !== exceptApplicationId))).length;
    out.set(p.package_code, Math.max(p.stock_total - taken, 0));
  }
  return out;
}

/** Sets the add-ons chosen for one application (only unpaid ones can change). Rules are enforced here, not just on screen; prices come from the catalogue. */
export async function setAddons(ownerId: string, applicationId: string, picks: { category: AddonCategory; packageCode: string }[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = admin();
  const { data: app } = await db.from("applications").select("id, package, trip_id, status").eq("id", applicationId).eq("owner_id", ownerId).maybeSingle();
  if (!app) return { ok: false, error: "err_not_found" };
  if (app.status !== "draft") return { ok: false, error: "err_locked" };
  const { data: trip } = await db.from("trips").select("arrival_airport_id").eq("id", app.trip_id).maybeSingle();
  const offers = await offersFor(app.package, trip?.arrival_airport_id ?? null, applicationId);
  const chosen: typeof offers = [];
  for (const pk of picks) {
    const o = offers.find((x) => x.category === pk.category && x.package_code === pk.packageCode);
    if (!o) return { ok: false, error: "err_generic" };
    if (!o.offer.available) return { ok: false, error: o.offer.reason === "stock" ? "err_addon_sold_out" : "err_addon_unavailable" };
    if (chosen.some((c) => c.category === o.category)) return { ok: false, error: "err_generic" };     // one per category
    chosen.push(o);
  }
  const { data: current } = await db.from("addon_orders").select("id, category, package_code").eq("application_id", applicationId).eq("status", "pending_payment");
  for (const c of current ?? []) if (!chosen.some((x) => x.category === c.category && x.package_code === c.package_code)) await db.from("addon_orders").update({ status: "cancelled" }).eq("id", c.id).eq("status", "pending_payment");
  for (const o of chosen) {
    if ((current ?? []).some((c) => c.category === o.category && c.package_code === o.package_code)) continue;
    const id = crypto.randomUUID();
    const ins = await db.from("addon_orders").insert({ id, owner_id: ownerId, application_id: applicationId, category: o.category, package_code: o.package_code, package_name: o.name, price_thb: o.price_thb, request_ref: `AO-${id.slice(0, 8)}-${Date.now().toString(36)}` }).select("id");
    if (ins.error || ins.data?.length !== 1) return { ok: false, error: "err_generic" };
  }
  return { ok: true };
}

// ------------------------------------------------------------------ issuing
const langOf = async (userId: string): Promise<Lang> => { const { data } = await admin().from("profiles").select("lang").eq("id", userId).maybeSingle(); return isLang(data?.lang) ? data.lang : "en"; };
const prefix = (id: number | null) => (id === 1 ? "MR" : id === 3 ? "MRS" : id === 4 ? "MASTER" : "MISS");
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

async function passportBio(applicationId: string): Promise<string | null> {
  const db = admin();
  const { data } = await db.from("documents").select("storage_path").eq("application_id", applicationId).eq("kind", "passport_bio").is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const dl = await db.storage.from("documents").download(data.storage_path);
  return dl.data ? decryptBytes(new Uint8Array(await dl.data.arrayBuffer())).toString("base64") : null;
}

type Order = { id: string; owner_id: string; application_id: string; category: AddonCategory; package_code: string; package_name: string; price_thb: number; request_ref: string; attempts: number; partner_ref: Record<string, unknown>; delivery: Record<string, unknown> };

async function notifyAddon(o: Pick<Order, "id" | "owner_id" | "application_id" | "package_name" | "category">, key: "ready" | "used" | "failed" | "result") {
  const t = DICTS[await langOf(o.owner_id)];
  const m = { ready: [t.notif_addon_ready_title, t.notif_addon_ready_body], used: [t.notif_addon_used_title, t.notif_addon_used_body], failed: [t.notif_addon_failed_title, t.notif_addon_failed_body], result: [t.notif_addon_result_title, t.notif_addon_result_body] }[key];
  await notifyUser({ userId: o.owner_id, title: m[0], body: fmt(m[1], { item: o.package_name }), link: `/trips/${o.application_id}`, kind: `addon.${key}`, dedupeKey: `addon:${o.id}:${key}`, fields: [[t.flex_item, o.package_name]] });
}

/**
 * Buys one paid add-on from its partner. Safe to call again: only a "paid" order (or an "issuing" one whose retry time has come) is claimed, and the partner receives the
 * same request_ref every time. A partner outage is retried with back-off; a refusal or too many failures marks it failed and gives the money back.
 */
export async function issueAddon(orderId: string): Promise<"issued" | "issuing" | "retry" | "failed" | "skipped"> {
  const db = admin();
  const now = new Date().toISOString();
  const claim = await db.from("addon_orders").update({ status: "issuing", next_attempt_at: new Date(Date.now() + 10 * 60_000).toISOString() }).eq("id", orderId).or(`status.eq.paid,and(status.eq.issuing,next_attempt_at.lte.${now})`).select("id, owner_id, application_id, category, package_code, package_name, price_thb, request_ref, attempts, partner_ref, delivery");
  if (!claim.data || claim.data.length !== 1) return "skipped";
  const o = claim.data[0] as Order;
  const attempts = o.attempts + 1;
  await db.from("addon_orders").update({ attempts }).eq("id", o.id);
  try {
    // A partner without an API (portal-managed) is "issued" here: a voucher code the partner redeems in its portal.
    const portal = await issueViaPortal(o);
    if (portal) {
      const done = await db.from("addon_orders").update({ status: "issued", partner_id: portal.partner_id, partner_ref: portal.partner_ref, delivery: portal.delivery, last_error: null, issued_at: new Date().toISOString() }).eq("id", o.id).eq("status", "issuing").select("id");
      if (done.data?.length !== 1) return "skipped";
      await notifyAddon(o, "ready");
      await audit({ actorId: null, actorRole: "system", action: "addon.issue", entity: "addon_order", entityId: o.id, detail: { category: o.category, portal: true } });
      return "issued";
    }
    const { data: app } = await db.from("applications").select("id, ref_no, traveler_id, trip_id, form").eq("id", o.application_id).single();
    const [{ data: tr }, { data: trip }] = await Promise.all([db.from("travelers").select("*").eq("id", app!.traveler_id).single(), db.from("trips").select("*").eq("id", app!.trip_id).single()]);
    const passport = decryptText(tr!.passport_no_enc);
    const form = (app!.form ?? {}) as { email?: string; mobile?: string; permanent_address?: string };
    const common = { PaymentReceiptRefNumber: o.request_ref, WebReferenceNumber: app!.ref_no, GivenName: tr!.given_name, SurName: tr!.surname, PassportNumber: passport, ArrivalAirportId: trip!.arrival_airport_id, ArrivalDate: trip!.arrival_date, ArrivalTime: trip!.arrival_time ?? "00:00", ArrivalFlightNumber: trip!.arrival_flight_no, ArrivalAirlinesId: trip!.arrival_airline_id };
    let partner_ref: Record<string, unknown> = {}, delivery: Record<string, unknown> = {}, finalStatus: "issued" | "issuing" = "issued";

    if (o.category === "insurance") {
      const end = trip!.departure_date ?? new Date(Date.parse(trip!.arrival_date) + 15 * 86_400_000).toISOString().slice(0, 10);
      const r = await partnerCall<{ status: string; data: Record<string, unknown> }>("insurance", "POST", "/travelPAPolicyIssueService", {
        RequestNo: o.request_ref, CountryName: "THAILAND", PlanCode: o.package_code, PolicyUnit: "D", PolicyType: "I", PolicyDate: dmy(trip!.arrival_date), ExpiryDate: dmy(end), NumberPerson: "1",
        NetAmount: String(o.price_thb), Amount: String(o.price_thb), CustomerType: "P", CustomerPrefix: prefix(tr!.salutation_id), CustomerName: tr!.given_name, CustomerSureName: tr!.surname, CardType: "P", IdCard: passport, Email: form.email ?? tr!.email ?? "",
        InsurePrefix: prefix(tr!.salutation_id), InsureName: tr!.given_name, InsureSurName: tr!.surname, InsureCardType: "P", InsureIdCard: passport, InsureEmail: form.email ?? tr!.email ?? "", Address1: form.permanent_address ?? "N/A",
      });
      if (r.status !== "success") throw new PartnerError("refused", `insurance refused: ${JSON.stringify(r.data ?? r).slice(0, 200)}`);
      partner_ref = { RequestNo: o.request_ref, policy_no: r.data.policy_no, invoice_no: r.data.invoice_No };
      finalStatus = "issuing";                                                       // becomes "issued" when the partner calls Confirm_COI with the e-card
    } else if (o.category === "sim" || o.category === "esim") {
      const bio = o.category === "sim" ? await passportBio(o.application_id) : null;
      const r = await partnerCall<{ status: number; message: string; result?: { TransactionID: string; esim?: { lpa: string; qr_url: string } } }>("sim", "POST", "/SIM/TRUE/sim_buy", { ...common, PackageCode: o.package_code, PackagePriceTHB: Number(o.price_thb), ...(bio ? { bioImage: bio } : {}) });
      if (r.status !== 0 || !r.result) throw new PartnerError("refused", `SIM refused: ${r.message}`);
      partner_ref = { TransactionID: r.result.TransactionID }; delivery = r.result.esim ? { esim_lpa: r.result.esim.lpa, esim_qr_url: r.result.esim.qr_url } : { pickup: "airport counter, show your passport" };
    } else if (o.category === "vip") {
      const r = await partnerCall<{ status: number; message: string; result?: { TransactionID: string } }>("vip", "POST", "/Services/VIP/vip_buy", { ...common, PackageCode: o.package_code, PackagePriceTHB: Number(o.price_thb) });
      if (r.status !== 0 || !r.result) throw new PartnerError("refused", `VIP refused: ${r.message}`);
      partner_ref = { TransactionID: r.result.TransactionID }; delivery = { pickup: "show your passport to the VIP staff after landing" };
    } else {
      const r = await partnerCall<{ status: number; message: string; result?: { voucherCode: string; voucherUrl: string } }>("bhs", "POST", "/wechat/gen_health_voucher", {
        packageCode: o.package_code, PaymentReceiptRefNumber: o.request_ref, WebReferenceNumber: app!.ref_no, ApplicantName: `${tr!.given_name} ${tr!.surname}`, Email: form.email ?? tr!.email ?? "", Mobile: form.mobile ?? tr!.phone ?? "", NationalityId: tr!.nationality_id,
        GivenName: tr!.given_name, SurName: tr!.surname, PassportNumber: passport, PassportExpiryDate: tr!.passport_expiry_date, PassportIssueDate: tr!.passport_issue_date, DateOfBirth: tr!.date_of_birth, GenderId: tr!.gender_id, SalutationId: tr!.salutation_id,
        ArrivalAirportId: trip!.arrival_airport_id, ArrivalDate: trip!.arrival_date, ArrivalTime: trip!.arrival_time ?? "00:00", ArrivalFlightNumber: trip!.arrival_flight_no, ArrivalAirlinesId: trip!.arrival_airline_id,
      });
      if (r.status !== 0 || !r.result) throw new PartnerError("refused", `health partner refused: ${r.message}`);
      partner_ref = { voucherCode: r.result.voucherCode }; delivery = { voucher_url: r.result.voucherUrl, voucher_code: r.result.voucherCode };
    }
    const done = await db.from("addon_orders").update({ status: finalStatus, partner_ref, delivery, last_error: null, issued_at: finalStatus === "issued" ? new Date().toISOString() : null }).eq("id", o.id).eq("status", "issuing").select("id");
    if (done.data?.length !== 1) return "skipped";
    if (finalStatus === "issued") await notifyAddon(o, "ready");
    await audit({ actorId: null, actorRole: "system", action: "addon.issue", entity: "addon_order", entityId: o.id, detail: { category: o.category } });
    return finalStatus;
  } catch (e) {
    const err = e as Error; const retryable = !(e instanceof PartnerError) || e.retryable;
    if (retryable && attempts < MAX_ATTEMPTS) {
      await db.from("addon_orders").update({ status: "paid", last_error: err.message.slice(0, 300), next_attempt_at: new Date(Date.now() + BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60_000).toISOString() }).eq("id", o.id);
      return "retry";
    }
    await db.from("addon_orders").update({ status: "failed", last_error: err.message.slice(0, 300) }).eq("id", o.id);
    await notifyAddon(o, "failed");
    const { refundAddon } = await import("@/lib/payments/service");
    await refundAddon(o.id, "add-on could not be issued", null);               // the money goes back automatically
    return "failed";
  }
}

/** Retries paid add-ons that are waiting (partner was down) — for the tick. */
export async function processAddonQueue(limit = 20): Promise<{ issued: number; retry: number; failed: number }> {
  const sum = { issued: 0, retry: 0, failed: 0 };
  const { data } = await admin().from("addon_orders").select("id").in("status", ["paid", "issuing"]).lte("next_attempt_at", new Date().toISOString()).order("next_attempt_at").limit(limit);
  for (const x of data ?? []) { const r = await issueAddon(x.id); if (r === "issued") sum.issued++; else if (r === "retry") sum.retry++; else if (r === "failed") sum.failed++; }
  return sum;
}

// ------------------------------------------------------------------ partner → ThaiPass callbacks
export type CbResult = { ok: boolean; message: string };

const fileHostAllowed = (url: string, provider: Provider) => { try { const u = new URL(url); const b = new URL(partnerBase(provider)); return u.host === b.host && (u.protocol === "https:" || process.env.NODE_ENV !== "production"); } catch { return false; } };

export async function handlePartnerCallback(provider: Provider, path: string, body: Record<string, unknown>): Promise<CbResult> {
  const db = admin();
  const find = async (col: string, value: unknown) => (typeof value === "string" && value ? (await db.from("addon_orders").select("id, owner_id, application_id, category, package_name, status, partner_ref, delivery").eq(col, value).maybeSingle()).data : null);
  if (provider === "insurance" && path.endsWith("/Confirm_COI")) {
    const o = await find("request_ref", body.RequestNo);
    if (!o) return { ok: false, message: "unknown RequestNo" };
    if (String(body.policy_status).toLowerCase() !== "success") return { ok: false, message: "policy not successful" };
    const delivery = { ...o.delivery, policy_url: body.policy_url, ecard_url: body.ecard_url };
    const upd = await db.from("addon_orders").update({ status: "issued", delivery, partner_ref: { ...o.partner_ref, policy_no: body.policy_no, invoice_no: body.invoice_No }, issued_at: new Date().toISOString(), last_error: null }).eq("id", o.id).in("status", ["issuing", "paid"]).select("id");
    if (upd.data?.length === 1) {
      await notifyAddon(o, "ready");
      // the policy certificate is attached to the application automatically (Immigration asks for insurance)
      if (typeof body.policy_url === "string" && fileHostAllowed(body.policy_url, "insurance")) {
        try {
          const res = await fetch(body.policy_url, { signal: AbortSignal.timeout(15_000) });
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (res.ok && bytes.length > 0 && bytes.length <= 1024 * 1024) {
            const { count } = await db.from("documents").select("id", { count: "exact", head: true }).eq("application_id", o.application_id).eq("kind", "insurance").is("deleted_at", null);
            if (!count) await saveDocument({ ownerId: o.owner_id, applicationId: o.application_id, kind: "insurance", docListId: DOC_LIST_ID.insurance, bytes });
          }
        } catch (e) { console.error("[partners] could not fetch the policy file", (e as Error).message); }
      }
      await runPreCheck(o.application_id).catch((e) => console.error("[partners] pre-check after insurance failed", (e as Error).message));
    }
    return { ok: true, message: "Success" };
  }
  if (provider === "sim" && path.endsWith("/sim_confirm")) return markUsed(await find("partner_ref->>TransactionID", body.TransactionID), body);
  if (provider === "vip" && path.endsWith("/vip_confirm")) return markUsed(await find("partner_ref->>TransactionID", body.TransactionID), body);
  if (provider === "bhs" && path.endsWith("/confirm_voucher")) return markUsed(await find("partner_ref->>voucherCode", body.VoucherCode), body);
  if (provider === "bhs" && path.endsWith("/callback_result")) {
    const o = await find("partner_ref->>voucherCode", body.VoucherCode);
    if (!o) return { ok: false, message: "unknown voucher" };
    await db.from("addon_orders").update({ delivery: { ...o.delivery, result: { report_date: body.ReportDateTime, result: body.LabReportResult, url: body.LabReportResultUrl } } }).eq("id", o.id).select("id");
    await notifyAddon(o, "result");
    return { ok: true, message: "Success" };
  }
  return { ok: false, message: "unknown callback" };

  async function markUsed(o: Awaited<ReturnType<typeof find>>, b: Record<string, unknown>): Promise<CbResult> {
    if (!o) return { ok: false, message: "unknown reference" };
    const upd = await db.from("addon_orders").update({ status: "used", used_at: new Date().toISOString(), delivery: { ...o.delivery, confirmed_by: b.ConfirmBy ?? b.HospitalName ?? null } }).eq("id", o.id).eq("status", "issued").select("id");
    if (upd.data?.length === 1) await notifyAddon(o, "used");          // repeated callbacks change nothing
    return { ok: true, message: "Success" };
  }
}
export { providerOf };
