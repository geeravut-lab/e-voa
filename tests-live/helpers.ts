// Shared by the Phase 4 live tests: a throw-away user with a signed-in client, SQL through the Management API, cleanup of what a run created.
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createDraftApplication, saveApplicationDocument, upsertTraveler } from "@/lib/applications/service";

export const { SB_URL, SB_ANON, SB_SERVICE } = process.env as Record<string, string>;
export const ref = new URL(SB_URL).hostname.split(".")[0];
export const noAuth = { auth: { persistSession: false, autoRefreshToken: false } } as const;
export const admin: SupabaseClient = createClient(SB_URL, SB_SERVICE, noAuth);
export const sql = async <T = Record<string, unknown>>(query: string): Promise<T[]> => {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    const text = await r.text();
    try { const j = JSON.parse(text); if (Array.isArray(j)) return j as T[]; throw new Error(text.slice(0, 300)); }
    catch (e) { if (attempt >= 4 || (e as Error).name !== "SyntaxError") throw e; await new Promise((res) => setTimeout(res, 1500 * attempt)); }
  }
};
export const users: string[] = [];
export async function makeUser(label: string, o: { admin?: boolean } = {}) {
  const email = `p2-${label}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`;
  const c = await admin.auth.admin.createUser({ email, email_confirm: true });
  const id = c.data.user!.id; users.push(id);
  if (o.admin) await sql(`insert into public.admins (user_id, is_owner) values ('${id}', false)`);
  const gl = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const v = await createClient(SB_URL, SB_SERVICE, noAuth).auth.verifyOtp({ type: "magiclink", token_hash: gl.data.properties!.hashed_token });
  const client = createClient(SB_URL, SB_ANON, { ...noAuth, global: { headers: { Authorization: `Bearer ${v.data.session!.access_token}` } } });
  return { id, email, client };
}
export type TUser = Awaited<ReturnType<typeof makeUser>>;
export const picture = () => sharp({ create: { width: 900, height: 1200, channels: 3, background: { r: 120, g: 160, b: 210 } } }).jpeg().toBuffer();
export const futureDate = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
export const DOCS = ["passport_bio", "photo", "return_ticket", "accommodation", "funds", "insurance"];

/** A draft application the way the wizard makes it (traveler, trip, application, documents). */
export async function makeDraft(user: TUser, tag: string, o: { days?: number; pkg?: "regular" | "express"; agencyId?: string } = {}) {
  const pkg = o.pkg ?? "regular";
  const trip = (await admin.from("trips").insert({ owner_id: user.id, agency_id: o.agencyId ?? null, package: pkg, arrival_airport_id: 1, arrival_date: futureDate(o.days ?? 12), arrival_time: "05:40", arrival_flight_no: "TG316", arrival_airline_id: 1, departure_date: futureDate((o.days ?? 12) + 10), departure_time: "09:00", departure_flight_no: "TG317", departure_airline_id: 1, purpose_id: 5, boarded_country_id: 1, next_city: "Bangkok", type_of_flight_id: 2 }).select("id").single()).data!;
  const t = await upsertTraveler(user.id, { given_name: "Test", surname: "Traveler", gender_id: 2, salutation_id: 2, date_of_birth: "1990-05-01", nationality_id: 1, passport_no: `T${Math.floor(100000 + Math.random() * 899999)}${tag}`, passport_issue_date: "2021-03-09", passport_expiry_date: "2031-03-08", passport_place_of_issue: "Delhi", email: user.email, phone: "912345678" });
  if (!t.ok) throw new Error(t.error);
  const app = await createDraftApplication(user.id, { tripId: trip.id, travelerId: t.id, pkg, form: { residency_id: 1, permanent_address: "Delhi", state: "Delhi", yearly_income_id: 2, occupation_id: 2, isd_code: "+91", mobile: "912345678", email: user.email, first_time_traveller: 1, stay: { place_of_stay_id: 1, name: "Test Hotel", city_id: 1, district_id: 101, sub_district_id: 1011, pin_code: "10330", street: "1 Test Road", reference: "BK123" } } });
  if (!app.ok) throw new Error(app.error);
  if (o.agencyId) await admin.from("applications").update({ agency_id: o.agencyId }).eq("id", app.id);
  for (const k of DOCS) { const r = await saveApplicationDocument(user.id, app.id, k, new Uint8Array(await picture())); if (!r.ok) throw new Error(`${k}: ${r.error}`); }
  return { tripId: trip.id as string, appId: app.id, travelerId: t.id };
}
export async function cleanupUsers(): Promise<string[]> {
  const problems: string[] = [];
  await Promise.all(users.map(async (id) => {
    const { data } = await admin.from("documents").select("storage_path").eq("owner_id", id);
    if (data?.length) await admin.storage.from("documents").remove(data.map((d) => d.storage_path));
    const r = await admin.auth.admin.deleteUser(id); if (r.error) problems.push(`user ${id}: ${r.error.message}`);
  }));
  return problems;
}
