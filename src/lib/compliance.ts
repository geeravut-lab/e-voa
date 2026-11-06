import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveDocument } from "@/lib/documents";
import { LEGAL_VERSION } from "@/lib/content/legal";

/** data:image/png;base64,… from the signature pad → PNG bytes (at most 150 KB), or null. */
export function decodeSignature(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const b = Buffer.from(m[1], "base64");
  return b.length > 200 && b.length <= 150 * 1024 && b[0] === 0x89 && b[1] === 0x50 ? new Uint8Array(b) : null;
}

export type ConsentInput = { signerName: string; signature: Uint8Array; withPartners: boolean };

/**
 * Writes what the traveler agreed to for every application of the trip: the accepted texts (privacy, terms, sharing with Immigration, sharing with partners when extras are chosen),
 * and the signed declaration (name + drawn signature, the picture stored encrypted like any other document). Safe to repeat: the same version is not written twice.
 */
export async function recordConsent(ownerId: string, tripId: string, c: ConsentInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createAdminClient();
  const { data: apps } = await db.from("applications").select("id").eq("trip_id", tripId).eq("owner_id", ownerId).in("status", ["draft", "awaiting_payment"]);
  if (!apps?.length) return { ok: false, error: "err_not_found" };
  const kinds = ["privacy", "terms", "immigration_share", ...(c.withPartners ? ["partner_share"] : [])];
  for (const a of apps) {
    const { data: have } = await db.from("consents").select("kind").eq("application_id", a.id).eq("version", LEGAL_VERSION);
    const rows = kinds.filter((k) => !(have ?? []).some((h) => h.kind === k)).map((kind) => ({ owner_id: ownerId, application_id: a.id, kind, version: LEGAL_VERSION }));
    if (rows.length) { const r = await db.from("consents").insert(rows); if (r.error) { console.error("[consent] insert failed", r.error.message); return { ok: false, error: "err_generic" }; } }
    const sig = await saveDocument({ ownerId, applicationId: a.id, kind: "signature", bytes: c.signature });
    if (!sig.ok) return sig;
    const old = await db.from("documents").select("id, storage_path").eq("application_id", a.id).eq("kind", "signature").is("deleted_at", null).neq("id", sig.id);
    for (const o of old.data ?? []) { await db.storage.from("documents").remove([o.storage_path]); await db.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", o.id).select("id"); }
    const d = await db.from("declarations").upsert({ application_id: a.id, owner_id: ownerId, signer_name: c.signerName.trim().slice(0, 120), version: LEGAL_VERSION, signature_document_id: sig.id, signed_at: new Date().toISOString() }).select("application_id");
    if (d.error || d.data?.length !== 1) { console.error("[consent] declaration failed", d.error?.message); return { ok: false, error: "err_generic" }; }
  }
  return { ok: true };
}
