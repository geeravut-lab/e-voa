// Staff roles. PURE: no server imports, so the menus, the pages, the actions and the tests share one table.
// A capability is an area of the back office. The owner has all of them; every other account has the ones of its role.
// This is enforced in the app (every admin page and action asks for its capability first); the database still treats every staff account as "admin" for its own rules.

export const CAPS = ["ops", "finance", "content", "config", "audit", "staff"] as const;
export type Cap = (typeof CAPS)[number];

export const ROLES = ["manager", "operator", "finance", "editor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_CAPS: Record<Role, readonly Cap[]> = {
  manager: ["ops", "finance", "content", "config", "audit"],      // everything except managing staff
  operator: ["ops"],                                               // works the application queue
  finance: ["finance", "audit"],                                   // revenue, reconciliation, discounts, agency payouts, refunds; may read the audit trail
  editor: ["content"],                                             // FAQ, news, travel guides, airport notes, AI instruction additions
};

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);

/** The capabilities of one staff account. An unknown role gets none (least privilege); the owner gets all. */
export function capsOf(role: unknown, isOwner: boolean): readonly Cap[] {
  if (isOwner) return CAPS;
  return isRole(role) ? ROLE_CAPS[role] : [];
}
export const can = (caps: readonly Cap[], need: Cap | undefined) => !need || caps.includes(need);
