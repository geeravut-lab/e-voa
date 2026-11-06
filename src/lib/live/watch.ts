// Pure rules for live sync: which pages listen to what, how often the fallback asks, what never refreshes by itself.
// Kept free of React/Supabase so it is unit-tested (watch.test.ts).

export type LiveKey = "notif" | "admin";
export type LiveWho = { userId: string; isAdmin: boolean };

/** Listen only to what the current page shows (the Realtime connection quota is counted per tab). */
export function liveTopicsFor(pathname: string, who: LiveWho): string[] {
  const topics = [`u:${who.userId}`];
  if (who.isAdmin && pathname.startsWith("/admin")) topics.push("admin");
  return topics;
}

/** Pages where an automatic refresh would disturb the user (chat, camera, long forms). */
const NO_REFRESH = [/^\/apply(\/|$)/, /^\/help(\/|$)/, /^\/login/, /^\/sso\//];

export function liveConfigFor(pathname: string, who: Pick<LiveWho, "isAdmin">): { keys: LiveKey[]; intervalMs: number; refresh: boolean } {
  const admin = who.isAdmin && pathname.startsWith("/admin");
  return {
    keys: admin ? ["notif", "admin"] : ["notif"],
    intervalMs: admin ? 8_000 : 12_000,
    refresh: !NO_REFRESH.some((r) => r.test(pathname)),
  };
}

/** The fallback slows down while nothing changes: ×1, ×2 after 6 quiet asks, ×4 after 18, never above 60 s. Hidden tab: 30 s. */
export function nextDelay(baseMs: number, quiet: number, hidden: boolean): number {
  if (hidden) return 30_000;
  const mult = quiet >= 18 ? 4 : quiet >= 6 ? 2 : 1;
  return Math.min(baseMs * mult, 60_000);
}

const ALLOWED: LiveKey[] = ["notif", "admin"];
/** Reads ?w=notif,admin and keeps only known keys. */
export function parseLiveKeys(raw: string | null | undefined): LiveKey[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((s) => s.trim()))].filter((k): k is LiveKey => (ALLOWED as string[]).includes(k));
}
