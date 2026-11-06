import type { DictKey } from "@/lib/i18n/dict";
import type { ArtName } from "@/components/Art";
import type { FeatureKey } from "./features";

/**
 * The ONLY list of menu entries. The sidebar, the mobile bottom bar, the "More" sheet and the home cards are all built from it,
 * so a page can never be in one menu and missing from another.
 */
export type IconName =
  | "home" | "plane" | "search" | "users" | "sparkles" | "map" | "chat" | "receipt" | "qr" | "bell" | "user"
  | "list" | "palette" | "toggle" | "shield" | "scroll" | "chart" | "settings" | "queue";

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
  home?: boolean;               // shown as a card on the home page
  side?: boolean;               // shown in the desktop sidebar
};

export const NAV: NavItem[] = [
  { key: "home", label: "nav_home", barLabel: "nav_home", href: "/", icon: "home", tone: "white", size: "wide", area: "traveler", auth: false, status: "live", bottom: true, side: true },
  { key: "apply", label: "card_apply", sub: "card_apply_sub", href: "/apply", icon: "plane", art: "apply", tone: "gold", size: "wide", area: "traveler", auth: true, status: "soon", phase: "Phase 2", feature: "apply", home: true, side: true },
  { key: "eligibility", label: "card_check", sub: "card_check_sub", href: "/eligibility", icon: "search", art: "check", tone: "sky", size: "half", area: "traveler", auth: false, status: "soon", phase: "Phase 2", feature: "eligibility", home: true, side: true },
  { key: "trips", label: "card_trips", barLabel: "nav_trips", sub: "card_trips_sub", href: "/trips", icon: "list", art: "trips", tone: "rose", size: "half", area: "traveler", auth: true, status: "soon", phase: "Phase 2", home: true, side: true, bottom: true },
  { key: "extras", label: "card_extras", sub: "card_extras_sub", href: "/extras", icon: "sparkles", art: "extras", tone: "mint", size: "wide", area: "traveler", auth: false, status: "soon", phase: "Phase 3", feature: "extras", home: true, side: true },
  { key: "travelers", label: "card_travelers", sub: "card_travelers_sub", href: "/travelers", icon: "users", art: "travelers", tone: "sand", size: "half", area: "traveler", auth: true, status: "soon", phase: "Phase 2", home: true, side: true },
  { key: "pass", label: "card_pass", sub: "card_pass_sub", href: "/pass", icon: "qr", art: "pass", tone: "sky", size: "half", area: "traveler", auth: true, status: "soon", phase: "Phase 2", home: true, side: true },
  { key: "guide", label: "card_guide", sub: "card_guide_sub", href: "/guide", icon: "map", art: "guide", tone: "mint", size: "wide", area: "traveler", auth: false, status: "soon", phase: "Phase 2", home: true, side: true },
  { key: "help", label: "card_help", barLabel: "nav_help", sub: "card_help_sub", href: "/help", icon: "chat", art: "help", tone: "sky", size: "half", area: "traveler", auth: false, status: "soon", phase: "Phase 4", feature: "ai_assistant", home: true, side: true, bottom: true },
  { key: "fees", label: "card_fees", sub: "card_fees_sub", href: "/fees", icon: "receipt", art: "fees", tone: "gold", size: "half", area: "traveler", auth: false, status: "soon", phase: "Phase 2", home: true, side: true },
  { key: "notifications", label: "card_notifications", sub: "card_notifications_sub", href: "/notifications", icon: "bell", art: "notifications", tone: "sand", size: "half", area: "traveler", auth: true, status: "live", feature: "notifications", home: true },
  { key: "account", label: "card_account", sub: "card_account_sub", href: "/account", icon: "user", art: "account", tone: "sky", size: "half", area: "traveler", auth: true, status: "live", home: true },

  { key: "ops", label: "card_ops", sub: "card_ops_sub", href: "/admin/queue", icon: "queue", art: "ops", tone: "gold", size: "wide", area: "admin", auth: true, status: "soon", phase: "Phase 2", home: true, side: true },
  { key: "branding", label: "card_branding", sub: "card_branding_sub", href: "/admin/branding", icon: "palette", art: "branding", tone: "rose", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "features", label: "card_features", sub: "card_features_sub", href: "/admin/features", icon: "toggle", art: "features", tone: "mint", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "admins", label: "card_admins", sub: "card_admins_sub", href: "/admin/admins", icon: "shield", art: "admins", tone: "sky", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "audit", label: "card_audit", sub: "card_audit_sub", href: "/admin/audit", icon: "scroll", art: "audit", tone: "sand", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "analytics", label: "card_analytics", sub: "card_analytics_sub", href: "/admin/analytics", icon: "chart", art: "analytics", tone: "gold", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
  { key: "settings", label: "card_settings", sub: "card_settings_sub", href: "/admin/settings", icon: "settings", art: "settings", tone: "mint", size: "half", area: "admin", auth: true, status: "live", home: true, side: true },
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
  { test: /^\/admin\/.+/, label: "nav_admin", href: "/admin" },
  { test: /^\/soon\/.+/, label: "nav_home", href: "/" },
  { test: /^\/(notifications|account)$/, label: "nav_home", href: "/" },
  { test: /^\/admin$/, label: "nav_home", href: "/" },
];
export const parentOf = (path: string) => PARENTS.find((p) => p.test.test(path)) ?? null;
