import type { DictKey } from "@/lib/i18n/dict";
import type { ArtName } from "@/components/Art";
import type { FeatureKey } from "./features";

/**
 * The ONLY list of menu entries. The sidebar, the mobile bottom bar, the "More" sheet and the home cards are all built from it,
 * so a page can never be in one menu and missing from another.
 */
export type IconName =
  | "home" | "plane" | "search" | "users" | "sparkles" | "map" | "chat" | "receipt" | "qr" | "bell" | "user"
  | "list" | "link" | "palette" | "toggle" | "shield" | "scroll" | "chart" | "settings" | "queue";

export type Tone = "gold" | "sky" | "mint" | "rose" | "sand" | "white";

export type NavItem = {
  key: string;
  label: DictKey;
  barLabel?: DictKey;           // shorter text for the mobile bottom bar
  sub?: DictKey;
  href: string;                 // where it goes when status is "live"
  icon: IconName;
  art?: ArtName;
  tone: Tone;
  size: "wide" | "half";
  area: "traveler" | "admin";
  auth: boolean;                // needs a signed-in user
  status: "live" | "soon";
  phase?: string;               // shown on the "coming soon" page
  feature?: FeatureKey;
  bottom?: boolean;             // one of the 4 fixed entries of the mobile bar (the 5th, centre, is "apply")
  viewerOnly?: boolean;         // shown only to read-only statistics accounts (report viewers)
  home?: boolean;               // shown as a card on the home page
  side?: boolean;               // shown in the desktop sidebar
};

export const NAV: NavItem[] = [
  { key: "home", label: "nav_home", barLabel: "nav_home", href: "/", icon: "home", tone: "white", size: "wide", area: "traveler", auth: false, status: "live", bottom: true, side: true },
  { key: "apply", label: "card_apply", sub: "card_apply_sub", href: "/apply", icon: "plane", art: "apply", tone: "gold", size: "wide", area: "traveler", auth: true, status: "live", phase: "Phase 2", feature: "apply", home: true, side: true },
  { key: "eligibility", label: "card_check", sub: "card_check_sub", href: "/eligibility", icon: "search", art: "check", tone: "sky", size: "half", area: "traveler", auth: false, status: "live", phase: "Phase 2", feature: "eligibility", home: true, side: true },
  { key: "trips", label: "card_trips", barLabel: "nav_trips", sub: "card_trips_sub", href: "/trips", icon: "list", art: "trips", tone: "rose", size: "half", area: "traveler", auth: true, status: "live", phase: "Phase 2", home: true, side: true, bottom: true },
  { key: "extras", label: "card_extras", sub: "card_extras_sub", href: "/extras", icon: "sparkles", art: "extras", tone: "mint", size: "wide", area: "traveler", auth: false, status: "live", phase: "Phase 3", feature: "extras", home: true, side: true },
  { key: "travelers", label: "card_travelers", sub: "card_travelers_sub", href: "/travelers", icon: "users", art: "travelers", tone: "sand", size: "half", area: "traveler", auth: true, status: "live", phase: "Phase 2", home: true, side: true },
  { key: "pass", label: "card_pass", sub: "card_pass_sub", href: "/pass", icon: "qr", art: "pass", tone: "sky", size: "half", area: "traveler", auth: true, status: "live", phase: "Phase 2", home: true, side: true },
  { key: "guide", label: "card_guide", sub: "card_guide_sub", href: "/guide", icon: "map", art: "guide", tone: "mint", size: "wide", area: "traveler", auth: false, status: "live", phase: "Phase 2", home: true, side: true },
  { key: "help", label: "card_help", barLabel: "nav_help", sub: "card_help_sub", href: "/help", icon: "chat", art: "help", tone: "sky", size: "half", area: "traveler", auth: false, status: "live", home: true, side: true, bottom: true },
  { key: "prepare", label: "prepare_title", sub: "prepare_sub", href: "/prepare", icon: "list", art: "check", tone: "mint", size: "half", area: "traveler", auth: false, status: "live", home: true, side: true },
  { key: "status", label: "status_title", sub: "status_hint", href: "/status", icon: "search", art: "trips", tone: "rose", size: "half", area: "traveler", auth: false, status: "live", home: true, side: true },
  { key: "fees", label: "card_fees", sub: "card_fees_sub", href: "/fees", icon: "receipt", art: "fees", tone: "gold", size: "half", area: "traveler", auth: false, status: "live", phase: "Phase 2", home: true, side: true },
  { key: "notifications", label: "card_notifications", sub: "card_notifications_sub", href: "/notifications", icon: "bell", art: "notifications", tone: "sand", size: "half", area: "traveler", auth: true, status: "live", feature: "notifications", home: true },
  { key: "account", label: "card_account", sub: "card_account_sub", href: "/account", icon: "user", art: "account", tone: "sky", size: "half", area: "traveler", auth: true, status: "live", home: true },
  { key: "agency", label: "card_agency", sub: "card_agency_sub", href: "/agency", icon: "users", art: "travelers", tone: "sand", size: "half", area: "traveler", auth: true, status: "live", home: true, side: true },
  { key: "partner", label: "card_partner", sub: "card_partner_sub", href: "/partner", icon: "sparkles", art: "extras", tone: "mint", size: "half", area: "traveler", auth: true, status: "live", home: true, side: true },
  { key: "gov", label: "admin_tourism_title", sub: "gov_hint", href: "/gov", icon: "chart", art: "analytics", tone: "gold", size: "half", area: "traveler", auth: true, status: "live", viewerOnly: true, home: true, side: true },

  { key: "admin_home", label: "nav_admin", barLabel: "nav_admin", href: "/admin", icon: "shield", tone: "sky", size: "half", area: "admin", auth: true, status: "live", side: true },
  { key: "admin_notifs", label: "admin_notif_title", barLabel: "nav_alerts", sub: "admin_notif_hint", href: "/admin/notifications", icon: "bell", art: "notifications", tone: "sand", size: "wide", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "revenue", label: "admin_revenue_title", sub: "admin_revenue_hint", href: "/admin/revenue", icon: "chart", art: "analytics", tone: "mint", size: "wide", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "reconcile", label: "admin_reconcile_title", sub: "admin_reconcile_hint", href: "/admin/reconcile", icon: "chart", art: "analytics", tone: "mint", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "discounts", label: "admin_discounts_title", sub: "admin_discounts_hint", href: "/admin/discounts", icon: "receipt", art: "fees", tone: "gold", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "tourism", label: "admin_tourism_title", sub: "admin_tourism_hint", href: "/admin/tourism", icon: "chart", art: "analytics", tone: "sky", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "ops", label: "card_ops", barLabel: "nav_queue", sub: "card_ops_sub", href: "/admin/queue", icon: "queue", art: "ops", tone: "gold", size: "wide", area: "admin", auth: true, status: "live", phase: "Phase 2", home: true, side: true },
  { key: "rules", label: "admin_rules_title", sub: "admin_rules_hint", href: "/admin/rules", icon: "toggle", art: "features", tone: "sand", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "admin_elig", label: "admin_elig_title", sub: "admin_elig_hint", href: "/admin/eligibility", icon: "search", art: "check", tone: "mint", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "errors", label: "errors_title", barLabel: "errors_title", sub: "errors_hint", href: "/admin/errors", icon: "scroll", art: "audit", tone: "rose", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "channels", label: "admin_channels_title", sub: "admin_channels_hint", href: "/admin/channels", icon: "link", art: "help", tone: "gold", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "company", label: "admin_company_title", sub: "admin_company_hint", href: "/admin/company", icon: "receipt", art: "fees", tone: "gold", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "airports", label: "admin_airports_title", sub: "admin_airports_hint", href: "/admin/airports", icon: "map", art: "guide", tone: "mint", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "content", label: "admin_content_title", sub: "admin_content_hint", href: "/admin/content", icon: "scroll", art: "guide", tone: "mint", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "ai", label: "admin_ai_title", sub: "admin_ai_hint", href: "/admin/ai", icon: "chat", art: "ai", tone: "sky", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "prompts", label: "admin_prompts_title", sub: "admin_prompts_hint", href: "/admin/prompts", icon: "scroll", art: "prompts", tone: "gold", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "messaging", label: "admin_msg_title", sub: "admin_msg_hint", href: "/admin/messaging", icon: "bell", art: "notifications", tone: "sand", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "agencies", label: "admin_agencies_title", sub: "admin_agencies_hint", href: "/admin/agencies", icon: "users", art: "travelers", tone: "sky", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "partners", label: "admin_partners_title", sub: "admin_partners_hint", href: "/admin/partners", icon: "users", art: "extras", tone: "sky", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "immigration", label: "card_immigration", sub: "card_immigration_sub", href: "/admin/immigration", icon: "link", art: "ops", tone: "sky", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "branding", label: "card_branding", sub: "card_branding_sub", href: "/admin/branding", icon: "palette", art: "branding", tone: "rose", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "features", label: "card_features", sub: "card_features_sub", href: "/admin/features", icon: "toggle", art: "features", tone: "mint", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "admins", label: "card_admins", sub: "card_admins_sub", href: "/admin/admins", icon: "shield", art: "admins", tone: "sky", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "audit", label: "card_audit", sub: "card_audit_sub", href: "/admin/audit", icon: "scroll", art: "audit", tone: "sand", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "analytics", label: "card_analytics", sub: "card_analytics_sub", href: "/admin/analytics", icon: "chart", art: "analytics", tone: "gold", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "settings", label: "card_settings", sub: "card_settings_sub", href: "/admin/settings", icon: "settings", art: "settings", tone: "mint", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "admin_account", label: "card_account", sub: "card_account_sub", href: "/account", icon: "user", art: "account", tone: "sky", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
];

export const navByKey = (key: string) => NAV.find((n) => n.key === key);

/** Where an entry really goes for this visitor. Unbuilt pages go to a friendly "coming soon" page; locked ones to sign-in. */
export function resolveHref(item: NavItem, signedIn: boolean): string {
  const target = item.status === "soon" ? `/soon/${item.key}` : item.href;
  if (item.auth && !signedIn) return `/login?next=${encodeURIComponent(target)}`;
  return target;
}

/** Back link: parent page by path pattern (written once; every page gets it). null = a top-level page, no back link. */
export const PARENTS: { test: RegExp; label: DictKey; href: string }[] = [
  { test: /^\/account\/.+/, label: "card_account", href: "/account" },
  { test: /^\/agency\/.+/, label: "card_agency", href: "/agency" },
  { test: /^\/partner\/.+/, label: "card_partner", href: "/partner" },
  { test: /^\/trips\/.+/, label: "card_trips", href: "/trips" },
  { test: /^\/pass\/.+/, label: "card_pass", href: "/pass" },
  { test: /^\/receipts\/.+/, label: "card_trips", href: "/trips" },
  { test: /^\/admin\/queue\/.+/, label: "card_ops", href: "/admin/queue" },
  { test: /^\/admin\/.+/, label: "nav_admin", href: "/admin" },
  { test: /^\/soon\/.+/, label: "nav_home", href: "/" },
  { test: /^\/(notifications|account|account\/password|agency|partner|trips|pass|fees|extras|eligibility|apply|help|prepare|guide|status|official|privacy|terms|travelers)$/, label: "nav_home", href: "/" },
];
export const parentOf = (path: string) => PARENTS.find((p) => p.test.test(path)) ?? null;

// ---------------------------------------------------------------- card colours
// The cards sit in a 2-column grid (a "wide" card takes a whole row). Colours are handed out in reading order so that cards that touch
// (left, above, and the two diagonals above) never share a colour, similar colours (gold/sand, sky/mint) are kept apart too, and every colour comes round evenly.
const SPREAD: Tone[] = ["gold", "sky", "mint", "rose", "sand"];
const FAMILY: Record<Tone, string> = { gold: "warm", sand: "warm", sky: "cool", mint: "cool", rose: "rose", white: "white" };
export function spreadTones(items: { key: string; size: "wide" | "half" }[]): Map<string, Tone> {
  const out = new Map<string, Tone>(), grid: Tone[][] = [], lastUse = new Map<Tone, number>();
  let row = 0, col = 0;
  items.forEach((it, idx) => {
    if (it.size === "wide") { if (col !== 0) { row++; col = 0; } } else if (col > 1) { row++; col = 0; }
    const cols = it.size === "wide" ? [0, 1] : [col];
    const near: Tone[] = [];
    for (const c of cols) for (const [dr, dc] of [[0, -1], [-1, -1], [-1, 0], [-1, 1]]) { const t = grid[row + dr]?.[c + dc]; if (t) near.push(t); }
    const score = (t: Tone) => (near.includes(t) ? 1000 : 0) + near.filter((n) => FAMILY[n] === FAMILY[t]).length * 40 - Math.min(idx - (lastUse.get(t) ?? -99), 12) * 3;
    const pick = [...SPREAD].sort((a, b) => score(a) - score(b))[0];
    out.set(it.key, pick); lastUse.set(pick, idx);
    grid[row] ??= [];
    for (const c of cols) grid[row][c] = pick;
    if (it.size === "wide") { row++; col = 0; } else { col++; if (col > 1) { row++; col = 0; } }
  });
  return out;
}

/**
 * Packs cards into the 2-column grid without holes: a half-width card that would stand alone in its row (the next card is wide, or it is the last one)
 * becomes full width. The order never changes. Call it on the cards that are really shown (after menus are filtered by role and feature switches).
 */
export function packCards<T extends { size: "wide" | "half" }>(items: T[]): T[] {
  const out: T[] = []; let col = 0;
  items.forEach((it, i) => {
    if (it.size === "wide") { out.push(it); col = 0; return; }
    const next = items[i + 1];
    if (col === 0 && (!next || next.size === "wide")) { out.push({ ...it, size: "wide" }); return; }
    out.push(it); col = col === 0 ? 1 : 0;
  });
  return out;
}

