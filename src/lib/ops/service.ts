import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { capsOf } from "@/lib/roles";
import { audit } from "@/lib/audit";
import { runPreCheck } from "@/lib/applications/service";
import { filterQuery, parseFilter, type BulkInput, type QueueFilter } from "./filters";

export type Assignee = { id: string; label: string; role: string };
const db = () => createAdminClient();

/** Staff who work the queue (their role has the "ops" capability), for the "assign to" lists. */
export async function listAssignees(): Promise<Assignee[]> {
  const { data: admins, error } = await db().from("admins").select("user_id, is_owner, role");
  const rows = error ? ((await db().from("admins").select("user_id, is_owner")).data ?? []).map((a) => ({ ...a, role: "manager" })) : (admins ?? []);
  const ops = rows.filter((a) => capsOf(a.role, !!a.is_owner).includes("ops"));
  if (ops.length === 0) return [];
  const { data: profiles } = await db().from("profiles").select("id, display_name, email").in("id", ops.map((a) => a.user_id));
  const p = new Map((profiles ?? []).map((x) => [x.id as string, x]));
  return ops.map((a) => { const pr = p.get(a.user_id); return { id: a.user_id as string, label: (pr?.display_name as string) || (pr?.email as string) || String(a.user_id).slice(0, 8), role: a.is_owner ? "owner" : (a.role as string) }; });
}

export type SavedFilter = { id: string; name: string; filter: QueueFilter };
export async function loadSavedFilters(userId: string): Promise<SavedFilter[]> {
  const { data, error } = await db().from("ops_saved_filters").select("id, name, query").eq("user_id", userId).order("created_at").limit(30);
  if (error) return [];                                                                           // fail open: no saved filters is not an outage
  return (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, filter: parseFilter(r.query as Record<string, unknown>) }));
}
export async function saveFilter(userId: string, name: string, f: QueueFilter): Promise<"ok" | "err_ops_filter_name" | "err_ops_filter_limit" | "err_generic"> {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < 1 || n.length > 60) return "err_ops_filter_name";
  const { count } = await db().from("ops_saved_filters").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= 20) return "err_ops_filter_limit";
  const q = Object.fromEntries(new URLSearchParams(filterQuery(f)));
  const up = await db().from("ops_saved_filters").upsert({ user_id: userId, name: n, query: q }, { onConflict: "user_id,name" }).select("id");
  return up.error || up.data?.length !== 1 ? "err_generic" : "ok";
}
export async function deleteFilter(userId: string, id: string): Promise<boolean> {
  const r = await db().from("ops_saved_filters").delete().eq("id", id).eq("user_id", userId).select("id");     // only your own filters
  return !r.error && r.data?.length === 1;
}

/** Sets (or clears) the person working on applications. Returns how many rows really changed. */
export async function assignApplications(ids: string[], assignee: string | null): Promise<number> {
  const r = await db().from("applications").update({ assigned_to: assignee, assigned_at: assignee ? new Date().toISOString() : null }).in("id", ids).select("id");
  return r.error ? 0 : (r.data?.length ?? 0);
}

export type BulkResult = { done: number; skipped: number };
/** One bulk request. Never changes a status except the "send again" path that the single-item button uses too (submission_failed → pre_check); decisions stay with Immigration (rule 8). */
export async function runBulk(actorId: string, b: BulkInput): Promise<BulkResult> {
  let done = 0;
  if (b.op === "assign_me" || b.op === "assign" || b.op === "unassign") {
    const who = b.op === "assign_me" ? actorId : b.op === "assign" ? b.assignee : null;
    if (who && b.op === "assign") { const ok = (await listAssignees()).some((x) => x.id === who); if (!ok) return { done: 0, skipped: b.ids.length }; }       // only people who can work the queue
    done = await assignApplications(b.ids, who);
  } else if (b.op === "note") {
    const ins = await db().from("application_notes").insert(b.ids.map((id) => ({ application_id: id, author_id: actorId, body: b.note }))).select("id");
    done = ins.error ? 0 : (ins.data?.length ?? 0);
  } else if (b.op === "retry") {
    for (const id of b.ids) {
      const { data, error } = await db().rpc("transition_application", { p_id: id, p_to: "pre_check", p_reason: null, p_source: "ops", p_actor: actorId, p_only_from: ["submission_failed"] });
      if (error || (data as { status?: string } | null)?.status !== "pre_check") continue;
      await runPreCheck(id).catch((e) => console.error("[ops] bulk retry pre-check failed", (e as Error).message));
      done++;
    }
  }
  await audit({ actorId, actorRole: "admin", action: `ops.bulk_${b.op}`, entity: "application", detail: { requested: b.ids.length, done } });
  return { done, skipped: b.ids.length - done };
}
