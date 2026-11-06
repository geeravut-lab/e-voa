import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Everything that waits for staff, computed live from the database (so it disappears by itself when it has been dealt with).
 * Each item says what happened, how many, and where to go. The bell for staff shows the total.
 */
export type AttentionItem = { key: "submission_failed" | "sla_overdue" | "addons_failed" | "refunds_failed" | "agencies_pending" | "partners_pending" | "settle_due" | "errors_24h"; count: number; href: string; severity: "high" | "normal"; refs?: string[] };

const SLA_OPEN = ["paid", "pre_check", "submitted", "under_review", "action_required"];

export async function attentionItems(): Promise<AttentionItem[]> {
  const db = createAdminClient();
  const head = { count: "exact", head: true } as const;
  const now = new Date(), nowIso = now.toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const day = new Date(now.getTime() - 86_400_000).toISOString(), week = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const [failed, overdue, addons, refunds, agencies, partners, settle, errors] = await Promise.all([
    db.from("applications").select("ref_no", { ...head }).eq("status", "submission_failed"),
    db.from("applications").select("ref_no", head).in("status", SLA_OPEN).lt("sla_due_at", nowIso),
    db.from("addon_orders").select("id", head).eq("status", "failed").gte("created_at", week),
    db.from("refunds").select("id", head).eq("status", "failed"),
    db.from("agencies").select("id", head).eq("status", "pending"),
    db.from("partners").select("id", head).eq("status", "pending"),
    db.from("addon_orders").select("id", head).eq("status", "used").is("settlement_id", null).not("partner_id", "is", null).lt("used_at", monthStart),
    db.from("error_log").select("id", head).gte("at", day),
  ]);
  const refs = async (status: string[], overdueOnly: boolean) => {
    let q = db.from("applications").select("ref_no").in("status", status).order("sla_due_at", { ascending: true, nullsFirst: false }).limit(5);
    if (overdueOnly) q = q.lt("sla_due_at", nowIso);
    return ((await q).data ?? []).map((r) => r.ref_no as string);
  };
  const out: AttentionItem[] = [];
  const add = (it: AttentionItem) => { if (it.count > 0) out.push(it); };
  add({ key: "submission_failed", count: failed.count ?? 0, href: "/admin/queue?g=attention", severity: "high", refs: (failed.count ?? 0) ? await refs(["submission_failed"], false) : undefined });
  add({ key: "sla_overdue", count: overdue.count ?? 0, href: "/admin/queue?g=active", severity: "high", refs: (overdue.count ?? 0) ? await refs(SLA_OPEN, true) : undefined });
  add({ key: "addons_failed", count: addons.count ?? 0, href: "/admin/queue?g=attention", severity: "high" });
  add({ key: "refunds_failed", count: refunds.count ?? 0, href: "/admin/queue?g=all", severity: "high" });
  add({ key: "agencies_pending", count: agencies.count ?? 0, href: "/admin/agencies", severity: "normal" });
  add({ key: "partners_pending", count: partners.count ?? 0, href: "/admin/partners", severity: "normal" });
  add({ key: "settle_due", count: settle.count ?? 0, href: "/admin/partners", severity: "normal" });
  add({ key: "errors_24h", count: errors.count ?? 0, href: "/admin/errors", severity: "normal" });
  return out;
}

/** The number on the bell. Never throws: a failing count just shows nothing. */
export async function attentionTotal(): Promise<number> {
  try { return (await attentionItems()).reduce((n, i) => n + i.count, 0); } catch { return 0; }
}
