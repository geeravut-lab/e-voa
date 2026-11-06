import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type MasterRow = { id: number; label: string; parent_id: number | null; extra: Record<string, unknown> };

/** Reference lists synced from Immigration (airports, airlines, nationalities, occupations …). */
export async function loadMaster(name: string, parentId?: number): Promise<MasterRow[]> {
  let q = createAdminClient().from("master_data").select("id, label, parent_id, extra").eq("name", name).order("sequence").order("label");
  if (parentId !== undefined) q = q.eq("parent_id", parentId);
  const { data } = await q.limit(2000);
  return (data ?? []) as MasterRow[];
}
export const loadMasters = async (names: string[]) => Object.fromEntries(await Promise.all(names.map(async (n) => [n, await loadMaster(n)] as const))) as Record<string, MasterRow[]>;
