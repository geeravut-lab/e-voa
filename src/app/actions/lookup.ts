"use server";
import { getViewer } from "@/lib/auth";
import { loadMaster } from "@/lib/master";

/** Districts of a city / sub-districts of a district, loaded when the traveler picks the parent (the full lists have thousands of rows). */
export async function loadChildrenAction(name: "district" | "subDistrict", parentId: number): Promise<{ id: number; label: string }[]> {
  const v = await getViewer();
  if (!v.user || !Number.isInteger(parentId)) return [];
  return (await loadMaster(name, parentId)).map((r) => ({ id: r.id, label: r.label }));
}
