import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Cap } from "@/lib/roles";

/**
 * Everything that waits for staff, computed live from the database (so it disappears by itself when it has been dealt with).
 * Each item says what happened, how many, and where to go. The bell for staff shows the total.
 */
export type AttentionItem = { sig: string; seen?: boolean; key: "submission_failed" | "sla_overdue" | "addons_failed" | "refunds_failed" | "agencies_pending" | "partners_pending" | "settle_due" | "errors_24h" | "recon_issues"; count: number; href: string; severity: "high" | "normal"; refs?: string[] };

const SLA_OPEN = ["paid", "pre_check", "submitted", "under_review", "action_required"];

export async function attentionItems(): Promise<AttentionItem[]> {
  const db = createAdminClient();
  const head = { count: "exact", head: true } as const;
  const now = new Date(), nowIso = now.toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const day = new Date(now.getTime() - 86_400_000).toISOString(), week = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const [failed, overdue, addons, refunds, agencies, partners, settle, errors, recon] = await Promise.all([
    db.from("applications").select("ref_no", { ...head }).eq("status", "submission_failed"),
    db.from("applications").select("ref_no", head).in("status", SLA_OPEN).lt("sla_due_at", nowIso),
    db.from("addon_orders").select("id", head).eq("status", "failed").gte("created_at", week),
    db.from("refunds").select("id", head).eq("status", "failed"),
    db.from("agencies").select("id", head).eq("status", "pending"),
    db.from("partners").select("id", head).eq("status", "pending"),
    db.from("addon_orders").select("id", head).eq("status", "used").is("settlement_id", null).not("partner_id", "is", null).lt("used_at", monthStart),
    db.from("error_log").select("id", head).gte("at", day),
    db.from("reconciliation_reports").select("day", head).eq("status", "issues").is("reviewed_at", null),
  ]);
  const refs = async (status: string[], overdueOnly: boolean) => {
    let q = db.from("applications").select("ref_no").in("status", status).order("sla_due_at", { ascending: true, nullsFirst: false }).limit(5);
    if (overdueOnly) q = q.lt("sla_due_at", nowIso);
    return ((await q).data ?? []).map((r) => r.ref_no as string);
  };
  const lastError = (errors.count ?? 0) > 0 ? ((await db.from("error_log").select("id").order("id", { ascending: false }).limit(1)).data?.[0]?.id ?? 0) : 0;
  const out: AttentionItem[] = [];
  const add = (it: Omit<AttentionItem, "sig"> & { sig?: string }) => { if (it.count > 0) out.push({ ...it, sig: it.sig ?? `${it.count}:${it.refs?.[0] ?? ""}` }); };
  add({ key: "submission_failed", count: failed.count ?? 0, href: "/admin/queue?g=attention", severity: "high", refs: (failed.count ?? 0) ? await refs(["submission_failed"], false) : undefined });
  add({ key: "sla_overdue", count: overdue.count ?? 0, href: "/admin/queue?g=active", severity: "high", refs: (overdue.count ?? 0) ? await refs(SLA_OPEN, true) : undefined });
  add({ key: "addons_failed", count: addons.count ?? 0, href: "/admin/queue?g=attention", severity: "high" });
  add({ key: "refunds_failed", count: refunds.count ?? 0, href: "/admin/queue?g=all", severity: "high" });
  add({ key: "agencies_pending", count: agencies.count ?? 0, href: "/admin/agencies", severity: "normal" });
  add({ key: "partners_pending", count: partners.count ?? 0, href: "/admin/partners", severity: "normal" });
  add({ key: "settle_due", count: settle.count ?? 0, href: "/admin/partners", severity: "normal" });
  add({ key: "errors_24h", count: errors.count ?? 0, href: "/admin/errors", severity: "normal", sig: `last:${lastError}` });
  add({ key: "recon_issues", count: recon.count ?? 0, href: "/admin/reconcile", severity: "high" });
  return out;
}

/** The same items with `seen` set for one administrator: seen = opened since it last changed. */
/** Which role area each alert belongs to: a staff account only sees (and is only counted for) the alerts of its own areas. */
export const ATTENTION_CAP: Record<AttentionItem["key"], Cap> = { submission_failed: "ops", sla_overdue: "ops", addons_failed: "ops", refunds_failed: "finance", agencies_pending: "finance", partners_pending: "config", settle_due: "finance", errors_24h: "audit", recon_issues: "finance" };

export async function attentionFor(userId: string, caps?: readonly Cap[]): Promise<AttentionItem[]> {
  const items = (await attentionItems()).filter((i) => !caps || caps.includes(ATTENTION_CAP[i.key]));
  const { data } = await createAdminClient().from("admin_alert_seen").select("key, signature").eq("user_id", userId);
  const seen = new Map((data ?? []).map((r) => [r.key as string, r.signature as string]));
  return items.map((i) => ({ ...i, seen: seen.get(i.key) === i.sig }));
}

/** Marks alerts as seen (one key, or all) at their current signature. */
export async function markAttentionSeen(userId: string, key?: string): Promise<void> {
  const items = (await attentionItems()).filter((i) => !key || i.key === key);
  if (items.length === 0) return;
  const { error } = await createAdminClient().from("admin_alert_seen").upsert(items.map((i) => ({ user_id: userId, key: i.key, signature: i.sig, seen_at: new Date().toISOString() })), { onConflict: "user_id,key" });
  if (error) console.error("[attention] could not mark seen", error.message);
}

/** The number on the bell: what is still unseen. Never throws: a failing count just shows nothing. */
export async function attentionTotal(userId: string, caps?: readonly Cap[]): Promise<number> {
  try { return (await attentionFor(userId, caps)).filter((i) => !i.seen).reduce((n, i) => n + i.count, 0); } catch { return 0; }
}
