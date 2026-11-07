import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMaster } from "@/lib/master";
import { getSetting } from "@/lib/settings";
import { checkEligibility, parseEligibility } from "@/lib/eligibility";
import { loadFees } from "@/lib/applications/service";
import { DEFAULT_REFUND_POLICY, parseRefundPolicy } from "@/lib/payments/refund-policy";
import { DICTS } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/langs";
import type { ToolDef } from "./types";

export const TOOLS: ToolDef[] = [
  { name: "get_my_applications", description: "List the signed-in user's own applications: reference, traveler first name, status in words, what the status means, arrival date and package. Returns an error text if nobody is signed in.", input_schema: { type: "object", properties: {}, additionalProperties: false }, strict: true },
  { name: "get_fees", description: "The current prices per traveler in Thai baht and the refund rule.", input_schema: { type: "object", properties: {}, additionalProperties: false }, strict: true },
  { name: "check_eligibility", description: "Whether a nationality is on the Visa on Arrival / visa-free list the service has loaded. Give the country name in English.", input_schema: { type: "object", properties: { nationality: { type: "string", description: "Country or nationality name in English" } }, required: ["nationality"], additionalProperties: false }, strict: true },
];

/** Runs one tool. Always returns a short text (never throws): the model reads it as data. Personal data returned is limited to the caller's own applications. */
export async function runTool(name: string, input: unknown, ctx: { userId: string | null; lang: Lang }): Promise<string> {
  try {
    if (name === "get_fees") {
      const fees = await loadFees(); const policy = parseRefundPolicy(await getSetting<unknown>("refund_policy", DEFAULT_REFUND_POLICY));
      return JSON.stringify({ visa_fee_thb: fees.visa_thb, service_fee_regular_thb: fees.regular_service_thb, service_fee_express_thb: fees.express_service_thb, visa_and_service_fee_refundable: policy.visa_fee_refundable, unused_extras_refundable: policy.unused_addons_refundable });
    }
    if (name === "get_my_applications") {
      if (!ctx.userId) return "Nobody is signed in. Tell the user to sign in, or to use Check my application (/status) with the reference, passport number and date of birth.";
      const db = createAdminClient(); const t = DICTS[ctx.lang] as unknown as Record<string, string>;
      const { data: apps } = await db.from("applications").select("ref_no, status, package, trip_id, traveler_id").eq("owner_id", ctx.userId).order("created_at", { ascending: false }).limit(10);
      if (!apps?.length) return "The user has no applications yet.";
      const rows = [];
      for (const a of apps) {
        const [{ data: trip }, { data: tr }] = await Promise.all([db.from("trips").select("arrival_date").eq("id", a.trip_id).maybeSingle(), db.from("travelers").select("given_name").eq("id", a.traveler_id).maybeSingle()]);
        rows.push({ reference: a.ref_no, traveler_first_name: tr?.given_name ?? null, status: t[`st_${a.status}`] ?? a.status, meaning: t[`sth_${a.status}`] ?? "", arrival_date: trip?.arrival_date ?? null, package: a.package });
      }
      return JSON.stringify(rows);
    }
    if (name === "check_eligibility") {
      const q = String((input as { nationality?: unknown })?.nationality ?? "").trim().toUpperCase().slice(0, 60);
      if (q.length < 3) return "Give a country name.";
      const nats = await loadMaster("nationality");
      const hit = nats.find((n) => n.label.toUpperCase() === q) ?? nats.find((n) => n.label.toUpperCase().includes(q) || q.includes(n.label.toUpperCase()));
      if (!hit) return `No nationality named "${q}" was found in the service's list.`;
      const code = String((hit.extra as { CountryCode?: string }).CountryCode ?? "");
      const res = checkEligibility(code, parseEligibility(await getSetting<unknown>("eligibility", { voa: [], visa_free: [] })));
      return JSON.stringify({ nationality: hit.label, result: res, note: res === "unknown" ? "The official lists have not been loaded yet; the service cannot answer. Suggest asking the Thai embassy or Thai Immigration." : "Information only; Thai Immigration decides." });
    }
    return "Unknown tool.";
  } catch (e) { console.error("[ai] tool failed", name, (e as Error).message); return "The tool could not run right now."; }
}
