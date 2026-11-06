import "server-only";
import { hasServiceRole } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Keys whose names suggest personal data are dropped before anything is written.
const PERSONAL = /name|address|phone|mobile|email|password|token|secret|passport|note|text|message/i;

export function cleanDetail(detail: Record<string, unknown> = {}): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (PERSONAL.test(k)) continue;
    if (v === null || typeof v === "number" || typeof v === "boolean") out[k] = v as null | number | boolean;
    else if (typeof v === "string") out[k] = v.slice(0, 80);
  }
  return out;
}

/** Records who did what. Call AFTER the work succeeded. Never throws: a failed audit write must not undo real work. */
export async function audit(a: {
  actorId: string | null;
  actorRole?: string;
  action: string;
  entity?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  if (!hasServiceRole()) return;
  try {
    const { error } = await createAdminClient().from("audit_log").insert({
      actor_id: a.actorId,
      actor_role: a.actorRole ?? "user",
      action: a.action,
      entity: a.entity ?? null,
      entity_id: a.entityId ?? null,
      detail: cleanDetail(a.detail),
    });
    if (error) console.error("[audit] write failed", a.action, error.message);
  } catch (e) {
    console.error("[audit] write failed", a.action, (e as Error).message);
  }
}
