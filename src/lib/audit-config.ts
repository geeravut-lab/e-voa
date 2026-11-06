// Which events the audit trail records. Pure (no database): the admin page, the writer and the tests share it.
export type AuditCategory = "auth" | "application" | "payment" | "document" | "ops" | "immigration" | "addon" | "partner" | "agency" | "channel" | "invoice" | "settings";
export const AUDIT_CATEGORIES: { id: AuditCategory; examples: string }[] = [
  { id: "auth", examples: "auth.login · auth.signout" },
  { id: "application", examples: "application.cancel · application.upgrade · trip.change · traveler.delete · consent.recorded · precheck.failed" },
  { id: "payment", examples: "payment.start · payment.paid · payment.refund · payment.failed" },
  { id: "document", examples: "document.view · documents.purge" },
  { id: "ops", examples: "ops.note · ops.cancel · ops.request_fix · ops.retry_send" },
  { id: "immigration", examples: "immigration.submit · immigration.decision · immigration.refused" },
  { id: "addon", examples: "addon.issue" },
  { id: "partner", examples: "partner.apply · partner.redeem · partner.settle · partner.package.*" },
  { id: "agency", examples: "agency.apply · agency.update · agency.import · agency.member.*" },
  { id: "channel", examples: "channel.link · channel.unlink" },
  { id: "invoice", examples: "invoice.issue" },
  { id: "settings", examples: "settings.* · feature.flags · brand.name" },
];
export type AuditConfig = { enabled: boolean; disabled: AuditCategory[] };
export const DEFAULT_AUDIT_CONFIG: AuditConfig = { enabled: true, disabled: [] };

const IDS = new Set<string>(AUDIT_CATEGORIES.map((c) => c.id));
const ALIASES: Record<string, AuditCategory> = { trip: "application", traveler: "application", consent: "application", precheck: "application", documents: "document", feature: "settings", brand: "settings" };

/** The group an action belongs to (by the word before the first dot). Unknown words get no group and are always recorded. */
export function categoryOf(action: string): AuditCategory | null {
  const head = action.split(".")[0];
  if (IDS.has(head)) return head as AuditCategory;
  return ALIASES[head] ?? null;
}
export function parseAuditConfig(v: unknown): AuditConfig {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { enabled: typeof o.enabled === "boolean" ? o.enabled : true, disabled: Array.isArray(o.disabled) ? o.disabled.filter((x): x is AuditCategory => typeof x === "string" && IDS.has(x)) : [] };
}
/** Administrator changes (grant / revoke) are written by the database itself and the audit settings change is always kept: nobody can switch off the record of who changed the rules. */
export function shouldRecord(action: string, cfg: AuditConfig, force = false): boolean {
  if (force) return true;
  if (!cfg.enabled) return false;
  const c = categoryOf(action);
  return !(c && cfg.disabled.includes(c));
}
