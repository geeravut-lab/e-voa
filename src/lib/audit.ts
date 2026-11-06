import "server-only";
import { hasServiceRole } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { DEFAULT_AUDIT_CONFIG, parseAuditConfig, shouldRecord } from "@/lib/audit-config";

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
  force?: boolean;                 // kept whatever the audit settings say (used for the change of the audit settings itself)
}): Promise<void> {
  if (!hasServiceRole()) return;
  try {
    // an administrator can switch the trail off or choose which kinds of events are kept (/admin/audit); if the setting cannot be read, everything is recorded
    const cfg = parseAuditConfig(await getSetting<unknown>("audit_config", DEFAULT_AUDIT_CONFIG));
    if (!shouldRecord(a.action, cfg, a.force)) return;
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
