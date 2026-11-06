import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ImmigrationGateway } from "./gateway";
import { MASTER_FLAT, type MasterItem, type MasterName } from "./schema";

const rowOf = (name: string, i: MasterItem, parent?: number) => {
  const { Id, Name, Sequence, ...extra } = i as MasterItem & Record<string, unknown>;
  return { name, id: Id, parent_id: parent ?? null, label: Name, sequence: Sequence ?? 0, extra, synced_at: new Date().toISOString() };
};

/** Replaces one list with Immigration's current version. An empty answer never deletes anything. */
export async function syncOne(gw: ImmigrationGateway, name: MasterName, parentId?: number): Promise<number> {
  const db = createAdminClient();
  const items = await gw.master(name, parentId);
  if (items.length === 0) return 0;
  const rows = items.map((i) => rowOf(name, i, parentId));
  const up = await db.from("master_data").upsert(rows, { onConflict: "name,id" }).select("id");
  if (up.error) throw new Error(up.error.message);
  // remove entries Immigration no longer lists (scoped to this list, or this parent)
  const keep = rows.map((r) => r.id);
  let del = db.from("master_data").delete().eq("name", name).not("id", "in", `(${keep.join(",")})`);
  if (parentId !== undefined) del = del.eq("parent_id", parentId);
  const d = await del; if (d.error) console.error("[sync] cleanup failed", name, d.error.message);
  return rows.length;
}

async function record(name: string, rows: number, error?: string) {
  await createAdminClient().from("master_sync").upsert({ name, last_synced_at: error ? undefined : new Date().toISOString(), row_count: rows, last_error: error ?? null }, { onConflict: "name" });
}

/** The flat lists (salutation … documentList). Each list is independent: one failing does not stop the others. */
export async function syncFlatLists(gw: ImmigrationGateway): Promise<{ rows: number; failed: string[] }> {
  let rows = 0; const failed: string[] = [];
  for (const name of MASTER_FLAT) {
    try { const n = await syncOne(gw, name); rows += n; await record(name, n); }
    catch (e) { failed.push(name); await record(name, 0, (e as Error).message.slice(0, 200)); }
  }
  return { rows, failed };
}

/** Districts per city and sub-districts per district. Many calls with the real list, so it runs a few at a time. */
export async function syncChildLists(gw: ImmigrationGateway, concurrency = 4): Promise<{ rows: number; failed: number }> {
  const db = createAdminClient();
  let rows = 0, failed = 0;
  const run = async (jobs: (() => Promise<number>)[]) => {
    for (let i = 0; i < jobs.length; i += concurrency) {
      const res = await Promise.allSettled(jobs.slice(i, i + concurrency).map((j) => j()));
      for (const r of res) { if (r.status === "fulfilled") rows += r.value; else failed++; }
    }
  };
  const { data: cities } = await db.from("master_data").select("id").eq("name", "city");
  await run((cities ?? []).map((c) => () => syncOne(gw, "district", c.id)));
  const { data: districts } = await db.from("master_data").select("id").eq("name", "district");
  await run((districts ?? []).map((d) => () => syncOne(gw, "subDistrict", d.id)));
  await record("district", (await db.from("master_data").select("id", { count: "exact", head: true }).eq("name", "district")).count ?? 0, failed ? `${failed} requests failed` : undefined);
  await record("subDistrict", (await db.from("master_data").select("id", { count: "exact", head: true }).eq("name", "subDistrict")).count ?? 0, failed ? `${failed} requests failed` : undefined);
  return { rows, failed };
}
