import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptText, encryptText } from "@/lib/crypto";

// Autosave of the traveler form. The text is encrypted like a passport number (it contains one) and only the server can read it.
// `slot` is the application id being edited, or "new" for a traveler who has not been saved yet.
const KEYS = ["given_name", "middle_name", "surname", "gender_id", "salutation_id", "date_of_birth", "nationality_id", "passport_no", "passport_issue_date", "passport_expiry_date", "passport_place_of_issue", "email", "phone", "isd_code",
  "residency_id", "permanent_address", "state", "yearly_income_id", "occupation_id", "place_of_stay_id", "stay_name", "city_id", "district_id", "sub_district_id", "pin_code", "street", "reference", "first_time_traveller"] as const;

/** Only known fields, only simple values, nothing long: a draft can never carry anything the form does not have. */
export function cleanDraft(input: unknown): Record<string, string | number> | null {
  if (!input || typeof input !== "object") return null;
  const out: Record<string, string | number> = {};
  for (const k of KEYS) { const v = (input as Record<string, unknown>)[k]; if ((typeof v === "string" && v.length <= 200 && v.trim() !== "") || (typeof v === "number" && Number.isFinite(v))) out[k] = v; }
  return Object.keys(out).length ? out : null;
}
const slotOk = (s: string) => s === "new" || /^[0-9a-f-]{36}$/i.test(s);

export async function saveDraft(ownerId: string, tripId: string, slot: string, data: unknown): Promise<boolean> {
  const clean = cleanDraft(data);
  if (!clean || !slotOk(slot)) return false;
  const r = await createAdminClient().from("form_drafts").upsert({ owner_id: ownerId, trip_id: tripId, slot, data_enc: encryptText(JSON.stringify(clean)), updated_at: new Date().toISOString() }).select("slot");
  return !r.error && r.data?.length === 1;
}
export async function loadDraft(ownerId: string, tripId: string, slot: string): Promise<Record<string, string | number> | null> {
  if (!slotOk(slot)) return null;
  const { data } = await createAdminClient().from("form_drafts").select("data_enc").eq("owner_id", ownerId).eq("trip_id", tripId).eq("slot", slot).maybeSingle();
  if (!data) return null;
  try { return cleanDraft(JSON.parse(decryptText(data.data_enc))); } catch { return null; }
}
export async function deleteDrafts(ownerId: string, tripId: string, slots: string[]): Promise<void> {
  await createAdminClient().from("form_drafts").delete().eq("owner_id", ownerId).eq("trip_id", tripId).in("slot", slots);
}
