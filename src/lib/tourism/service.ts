import "server-only";
import { notFound } from "next/navigation";
import { getViewer, type Viewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMasters } from "@/lib/master";
import type { Dict } from "@/lib/i18n/dict/en";
import type { Range } from "@/lib/revenue/range";
import { OTHER, UNKNOWN, buildReport, parseStats, type Report, type Section } from "./stats";
import type { User } from "@supabase/supabase-js";

/** Who may see the statistics: staff, and accounts staff added as report viewers. Everyone else gets nothing (a plain 404). */
export async function canViewTourism(v: Viewer): Promise<boolean> {
  if (!v.user) return false;
  if (v.isAdmin) return true;
  const { data } = await createAdminClient().from("report_viewers").select("user_id").eq("user_id", v.user.id).maybeSingle();
  return !!data;
}
export async function requireTourismPage(): Promise<Viewer & { user: User }> {
  const v = await getViewer();
  if (!v.user || !(await canViewTourism(v))) notFound();
  return v as Viewer & { user: User };
}

export const SECTION_KEYS: Record<Section, keyof Dict> = { nationality: "tourism_s_nationality", airport: "tourism_s_airport", purpose: "tourism_s_purpose", gender: "tourism_s_gender", age: "tourism_s_age", stay: "tourism_s_stay", package: "tourism_s_package" };
const MASTER: Partial<Record<Section, string>> = { nationality: "nationality", airport: "arrivalAirport", purpose: "purposeOfVisit", gender: "gender" };

export async function loadReport(range: Range, t: Dict): Promise<Report> {
  const [{ data, error }, masters] = await Promise.all([
    createAdminClient().rpc("tourism_stats", { p_from: range.fromDate, p_to: range.toDate }),
    loadMasters(["nationality", "arrivalAirport", "purposeOfVisit", "gender"]),
  ]);
  if (error) console.error("[tourism] stats failed", error.message);
  const names: Record<string, Map<string, string>> = {};
  for (const [section, master] of Object.entries(MASTER)) names[section] = new Map((masters[master!] ?? []).map((m) => [String(m.id), m.label]));
  const tt = t as unknown as Record<string, string>;
  const label = (s: Section, k: string): string => {
    if (k === OTHER) return t.tourism_other;
    if (k === UNKNOWN || k === "null") return t.tourism_unknown;
    if (s === "package") return tt[`tourism_pkg_${k}`] ?? k;
    if (s === "stay") return `${k} ${t.tourism_days}`;
    if (s === "age") return k;
    return names[s]?.get(k) ?? `#${k}`;
  };
  return buildReport(parseStats(data), { from: range.fromDate, to: range.toDate }, label);
}

export async function listViewers(): Promise<{ user_id: string; email: string | null; created_at: string }[]> {
  const db = createAdminClient();
  const { data } = await db.from("report_viewers").select("user_id, created_at").order("created_at");
  const ids = (data ?? []).map((r) => r.user_id);
  const { data: profiles } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] as { id: string; email: string | null }[] };
  const email = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  return (data ?? []).map((r) => ({ ...r, email: email.get(r.user_id) ?? null }));
}
