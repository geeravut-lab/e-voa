import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { decryptBytes, encryptBytes, sha256Hex, ENC_VERSION } from "@/lib/crypto";

const BUCKET = "documents";
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024 - 1024; // bucket limit is 5 MB; leave room for the encryption header and tag
export type DocKind = "passport_bio" | "photo" | "return_ticket" | "accommodation" | "funds" | "insurance" | "additional" | "evoa" | "other" | "signature";
export type DocMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

/** The real type of a file from its first bytes (never from the extension or the browser's claim). */
export function sniffDocument(b: Uint8Array): DocMime | null {
  if (b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  return null;
}

type SaveInput = { ownerId: string; agencyId?: string | null; applicationId?: string | null; travelerId?: string | null; kind: DocKind; docListId?: number | null; bytes: Uint8Array };

/** Encrypts the file, stores it in the private bucket, records it. If recording fails the stored file is removed again. */
export async function saveDocument(a: SaveInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (a.bytes.length === 0) return { ok: false, error: "err_file_missing" };
  if (a.bytes.length > MAX_DOCUMENT_BYTES) return { ok: false, error: "err_file_big" };
  const mime = sniffDocument(a.bytes);
  if (!mime) return { ok: false, error: "err_file_type" };
  const db = createAdminClient();
  const id = randomUUID();
  const path = `${a.ownerId}/${a.applicationId ?? "loose"}/${id}.enc`;
  const up = await db.storage.from(BUCKET).upload(path, encryptBytes(a.bytes), { contentType: "application/octet-stream", upsert: false });
  if (up.error) { console.error("[documents] upload failed", up.error.message); return { ok: false, error: "err_generic" }; }
  const ins = await db.from("documents").insert({
    id, owner_id: a.ownerId, agency_id: a.agencyId ?? null, application_id: a.applicationId ?? null, traveler_id: a.travelerId ?? null, kind: a.kind, doc_list_id: a.docListId ?? null,
    storage_path: path, mime, size_bytes: a.bytes.length, sha256: sha256Hex(a.bytes), enc_version: ENC_VERSION,
  }).select("id");
  if (ins.error || ins.data?.length !== 1) {
    console.error("[documents] record failed", ins.error?.message);
    await db.storage.from(BUCKET).remove([path]);
    return { ok: false, error: "err_generic" };
  }
  return { ok: true, id };
}

export type Viewer = { id: string; isAdmin: boolean };

/** Decrypts one file for its owner or an admin. Staff access to someone else's document is written to the audit trail. */
export async function readDocument(id: string, viewer: Viewer): Promise<{ bytes: Buffer; mime: string; kind: DocKind } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = createAdminClient();
  const { data: doc } = await db.from("documents").select("id, owner_id, storage_path, mime, kind, deleted_at, sha256").eq("id", id).maybeSingle();
  if (!doc || doc.deleted_at) return null;
  if (doc.owner_id !== viewer.id && !viewer.isAdmin) return null;
  const dl = await db.storage.from(BUCKET).download(doc.storage_path);
  if (dl.error || !dl.data) { console.error("[documents] download failed", dl.error?.message); return null; }
  let bytes: Buffer;
  try { bytes = decryptBytes(new Uint8Array(await dl.data.arrayBuffer())); }
  catch { console.error("[documents] decrypt failed for", id); return null; }          // changed or wrong key: never show it
  if (doc.sha256 && sha256Hex(bytes) !== doc.sha256) { console.error("[documents] checksum mismatch for", id); return null; }
  if (doc.owner_id !== viewer.id) await audit({ actorId: viewer.id, actorRole: "admin", action: "document.view", entity: "document", entityId: id, detail: { kind: doc.kind } });
  return { bytes, mime: doc.mime, kind: doc.kind as DocKind };
}

/** Removes files whose retention window has passed (see documents_due_for_purge) and marks the rows. Returns how many were removed. */
export async function purgeExpiredDocuments(retentionDays: number, limit = 200): Promise<{ removed: number; failed: number }> {
  const db = createAdminClient();
  const { data: due, error } = await db.rpc("documents_due_for_purge", { p_days: retentionDays, p_limit: limit });
  if (error) { console.error("[documents] purge query failed", error.message); return { removed: 0, failed: 0 }; }
  let removed = 0, failed = 0;
  for (const d of (due ?? []) as { id: string; storage_path: string }[]) {
    const rm = await db.storage.from(BUCKET).remove([d.storage_path]);
    if (rm.error) { failed++; continue; }
    const upd = await db.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", d.id).select("id");
    if (upd.data?.length === 1) removed++; else failed++;                                // count rows: an update that matches nothing is not success
  }
  if (removed) await audit({ actorId: null, actorRole: "system", action: "documents.purge", entity: "document", detail: { removed, retention_days: retentionDays } });
  return { removed, failed };
}
