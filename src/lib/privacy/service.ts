import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptText } from "@/lib/crypto";
import { audit } from "@/lib/audit";

// PDPA / GDPR: a person can download what we hold about them and ask us to erase it.
// Erasure removes or blanks everything that identifies the person. What the law requires us to keep (payments, receipts, tax invoices, the consent record)
// stays, with no link to a name or contact left on the account: the sign-in itself is closed for good.
const db = () => createAdminClient();
const IN_FLIGHT = ["paid", "pre_check", "action_required", "submitted", "submission_failed", "under_review"];

/** Reasons the account cannot be erased right now (codes the screen turns into sentences). Empty = it can be. */
export async function erasureBlockers(userId: string): Promise<string[]> {
  const out: string[] = [];
  const [apps, addons, pays, adm, agency, partner] = await Promise.all([
    db().from("applications").select("id", { count: "exact", head: true }).eq("owner_id", userId).in("status", IN_FLIGHT),
    db().from("addon_orders").select("id", { count: "exact", head: true }).eq("owner_id", userId).in("status", ["paid", "issuing"]),
    db().from("payments").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "pending").gt("expires_at", new Date().toISOString()),
    db().from("admins").select("user_id").eq("user_id", userId).maybeSingle(),
    db().from("agency_members").select("agency_id").eq("user_id", userId).eq("role", "owner").limit(1),
    db().from("partner_members").select("partner_id").eq("user_id", userId).eq("role", "owner").limit(1),
  ]);
  if ((apps.count ?? 0) > 0 || (addons.count ?? 0) > 0) out.push("err_erase_in_progress");
  if ((pays.count ?? 0) > 0) out.push("err_erase_payment_open");
  if (adm.data) out.push("err_erase_admin");
  if (agency.data?.length || partner.data?.length) out.push("err_erase_owner");
  return out;
}

const safeDecrypt = (v: string | null) => { if (!v) return null; try { return decryptText(v); } catch { return null; } };

/** Everything we hold about this person, as one JSON document (documents are listed, the files themselves are downloaded from each application). */
export async function exportMyData(userId: string, email: string | null): Promise<Record<string, unknown>> {
  const q = async (table: string, cols: string, col = "owner_id", order = "created_at") => (await db().from(table).select(cols).eq(col, userId).order(order, { ascending: true }).limit(5000)).data ?? [];
  const [profile, consents, travelers, trips, apps, declarations, docs, payments, addons, tax, notices, channels, refundsRaw] = await Promise.all([
    db().from("profiles").select("display_name, email, lang, email_notices, created_at").eq("id", userId).maybeSingle().then((r) => r.data),
    q("consents", "kind, version, accepted_at", "owner_id", "accepted_at"),
    q("travelers", "id, relation, given_name, middle_name, surname, gender_id, salutation_id, date_of_birth, nationality_id, passport_no_enc, passport_issue_date, passport_expiry_date, passport_place_of_issue, email, phone, created_at"),
    q("trips", "id, arrival_airport_id, arrival_date, arrival_time, arrival_flight_no, arrival_airline_id, arrival_pnr, departure_date, departure_time, departure_flight_no, departure_airline_id, departure_pnr, purpose_id, boarded_country_id, next_city, package, created_at"),
    q("applications", "id, ref_no, trip_id, traveler_id, package, status, status_reason, form, visa_fee_thb, service_fee_thb, immigration_ref, submitted_at, decided_at, created_at"),
    q("declarations", "application_id, signer_name, version, signed_at", "owner_id", "signed_at"),
    q("documents", "id, application_id, traveler_id, kind, mime, size_bytes, created_at, deleted_at"),
    q("payments", "id, amount_thb, status, refunded_thb, provider, receipt_no, kind, items, created_at, paid_at"),
    q("addon_orders", "id, application_id, category, package_name, price_thb, status, refunded_thb, created_at, issued_at, used_at"),
    q("tax_invoices", "invoice_no, payment_id, issued_at, buyer, lines, net_thb, vat_thb, total_thb", "owner_id", "issued_at"),
    q("app_notifications", "kind, title, body, created_at, read_at", "user_id"),
    q("notification_channels", "channel, status, created_at, verified_at"),
    (async () => { const ids = (await q("payments", "id")).map((p) => (p as unknown as { id: string }).id); return ids.length ? ((await db().from("refunds").select("payment_id, amount_thb, kind, reason, status, created_at").in("payment_id", ids)).data ?? []) : []; })(),
  ]);
  return {
    generated_at: new Date().toISOString(), account: { id: userId, email, ...profile },
    note: "This file holds the data ThaiPass keeps about your account. Uploaded document files can be downloaded from each application page. Passport numbers are shown in clear text here because only you receive this file.",
    consents,
    travelers: (travelers as unknown as Record<string, unknown>[]).map(({ passport_no_enc, ...t }) => ({ ...t, passport_no: safeDecrypt(passport_no_enc as string | null) })),
    trips, applications: apps, declarations, documents: docs, payments, refunds: refundsRaw, addon_orders: addons, tax_invoices: tax, notifications: notices, notification_channels: channels,
  };
}

/**
 * Erases the account. Order matters: files first, then rows that hold personal data, then the sign-in. Returns the first problem; a repeated call finishes what is left.
 * Kept on purpose: payments, refunds, receipts, tax invoices, application rows without their form data, consent records (accounting and legal duties).
 */
export async function eraseAccount(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const blockers = await erasureBlockers(userId); if (blockers.length) return { ok: false, error: blockers[0] };
  const step = async (name: string, p: PromiseLike<{ error: { message: string } | null }>) => { const r = await p; if (r.error) throw new Error(`${name}: ${r.error.message}`); };
  try {
    // 1) uploaded files, then their rows (declarations point to a signature file, so they go first)
    const { data: files } = await db().from("documents").select("storage_path").eq("owner_id", userId);
    const paths = (files ?? []).map((f) => f.storage_path).filter(Boolean);
    for (let i = 0; i < paths.length; i += 100) await db().storage.from("documents").remove(paths.slice(i, i + 100));
    await step("declarations", db().from("declarations").delete().eq("owner_id", userId));
    await step("documents", db().from("documents").delete().eq("owner_id", userId));
    // 2) rows that hold personal data
    for (const [t, c] of [["form_drafts", "owner_id"], ["app_notifications", "user_id"], ["notification_channels", "owner_id"], ["message_log", "owner_id"], ["agency_members", "user_id"], ["partner_members", "user_id"], ["aivora_links", "user_id"], ["product_events", "user_id"], ["report_viewers", "user_id"]] as const)
      await step(t, db().from(t).delete().eq(c, userId));
    await step("travelers", db().from("travelers").update({ given_name: "Deleted", middle_name: null, surname: "traveler", date_of_birth: null, passport_no_enc: null, passport_no_hash: null, passport_last4: null, passport_issue_date: null, passport_expiry_date: null, passport_place_of_issue: null, email: null, phone: null }).eq("owner_id", userId));
    await step("trips", db().from("trips").update({ arrival_pnr: null, departure_pnr: null }).eq("owner_id", userId));
    await step("applications", db().from("applications").update({ form: {}, status_reason: null }).eq("owner_id", userId));
    await step("profile", db().from("profiles").update({ display_name: null, email: null, avatar_url: null, email_notices: false }).eq("id", userId));
    // 3) the sign-in: a new unusable e-mail and password, no profile data, banned for good (an old session stops working at its next refresh)
    const rand = crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
    const upd = await db().auth.admin.updateUserById(userId, { email: `erased-${userId}@erased.invalid`, password: rand, user_metadata: {}, app_metadata: { erased: true }, ban_duration: "876000h" });
    if (upd.error) throw new Error(`sign-in: ${upd.error.message}`);
    await audit({ actorId: userId, action: "account.erase", entity: "profiles", entityId: userId });
    return { ok: true };
  } catch (e) { console.error("[privacy] erase failed", (e as Error).message); return { ok: false, error: "err_generic" }; }
}
