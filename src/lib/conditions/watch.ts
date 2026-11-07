import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notify";
import { DICTS, fmt } from "@/lib/i18n/dict";
import { isLang, type Lang } from "@/lib/i18n/langs";
import { forLang } from "@/lib/content/types";
import { PLACES, findPlace } from "./places";
import { loadWarnings } from "./service";
import { warningsFor, warningLevel, type Warning } from "./tmd";

const db = () => createAdminClient();
export const MAX_WATCHES = 5;

export async function listWatches(userId: string): Promise<string[]> {
  const { data, error } = await db().from("warning_watches").select("place_slug").eq("user_id", userId).order("created_at");
  return error ? [] : (data ?? []).map((r) => r.place_slug as string).filter((s) => PLACES.some((p) => p.slug === s));
}
export async function addWatch(userId: string, slug: string): Promise<"ok" | "err_watch_limit" | "err_generic"> {
  if (!findPlace(slug) || findPlace(slug)!.slug !== slug) return "err_generic";
  const have = await listWatches(userId);
  if (have.includes(slug)) return "ok";
  if (have.length >= MAX_WATCHES) return "err_watch_limit";
  const r = await db().from("warning_watches").upsert({ user_id: userId, place_slug: slug }, { onConflict: "user_id,place_slug" }).select("place_slug");
  return r.error || r.data?.length !== 1 ? "err_generic" : "ok";
}
export async function removeWatch(userId: string, slug: string): Promise<boolean> {
  const r = await db().from("warning_watches").delete().eq("user_id", userId).eq("place_slug", slug).select("place_slug");
  return !r.error && (r.data?.length ?? 0) > 0;
}

/** Only warnings that matter to a traveler: moderate, severe or extreme. Minor ones stay on the page but do not ring a phone. */
export const worthAlerting = (w: Warning) => warningLevel(w.severity) !== "info";

export type WarningRun = { checked: number; sent: number };
/**
 * Tells everyone who watches a place when the Thai Meteorological Department has a warning in force for its province. One notice per person and warning
 * (the de-duplication key holds even if this runs every 10 minutes). Push, LINE and the in-app list carry it; e-mail does not (it is time-critical and short-lived).
 * `opts.onlyUsers` narrows a run to some people (used by the automated tests).
 */
export async function runWarningAlerts(now = new Date(), opts: { onlyUsers?: string[] } = {}): Promise<WarningRun> {
  const out: WarningRun = { checked: 0, sent: 0 };
  const all = await loadWarnings(); if (!all || all.length === 0) return out;
  let q = db().from("warning_watches").select("user_id, place_slug").limit(5000); if (opts.onlyUsers) q = q.in("user_id", opts.onlyUsers);
  const { data: watches } = await q; if (!watches?.length) return out;
  const langs = new Map<string, Lang>();
  const ids = [...new Set(watches.map((w) => w.user_id as string))];
  for (let i = 0; i < ids.length; i += 200) { const { data } = await db().from("profiles").select("id, lang").in("id", ids.slice(i, i + 200)); for (const p of data ?? []) langs.set(p.id as string, isLang(p.lang) ? p.lang : "en"); }
  const bySlug = new Map<string, Warning[]>();
  for (const w of watches) {
    const place = PLACES.find((p) => p.slug === w.place_slug); if (!place) continue;
    if (!bySlug.has(place.slug)) bySlug.set(place.slug, warningsFor(place, all, now).filter(worthAlerting));
    for (const warn of bySlug.get(place.slug) ?? []) {
      out.checked++;
      const lang = langs.get(w.user_id as string) ?? "en", t = DICTS[lang];
      const until = warn.expires ? warn.expires.slice(0, 16).replace("T", " ") : "—";
      const ok = await notifyUser({
        userId: w.user_id as string, title: fmt(t.warn_alert_title, { place: forLang(place.name, lang) }), body: fmt(t.warn_alert_body, { event: warn.event, headline: warn.headline || warn.event, until }),
        link: `/conditions?place=${place.slug}`, kind: "weather.warning", dedupeKey: `tmd:${warn.id}:${place.slug}`, mail: false, fields: [[t.cond_warnings, warn.headline || warn.event]],
      });
      if (ok && (await countOnce(w.user_id as string, `tmd:${warn.id}:${place.slug}`))) out.sent++;
    }
  }
  return out;
}
// notifyUser returns true for a repeat as well; count a notice as "sent" only the first time it exists for this person.
const seen = new Set<string>();
async function countOnce(userId: string, key: string): Promise<boolean> {
  const k = `${userId}|${key}`; if (seen.has(k)) return false; seen.add(k);
  const { count } = await db().from("app_notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("dedupe_key", key).gte("created_at", new Date(Date.now() - 120_000).toISOString());
  return (count ?? 0) > 0;
}
