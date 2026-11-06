import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting, putSetting } from "@/lib/settings";
import { notifyUser } from "@/lib/notify";
import { DICTS, fmt } from "@/lib/i18n/dict";
import { isLang, type Lang } from "@/lib/i18n/langs";
import { DEFAULT_RULES, hoursLeft, needsFixReminder, needsPaymentReminder, parseRules, shouldExpire, slaLevel, type RulesConfig } from "./rules";

export type RulesRun = { at: string; payment_reminders: number; expired: number; fix_reminders: number; sla_warnings: number; sla_overdue: number };
const db = () => createAdminClient();
const LIMIT = 100;

export const loadRules = async (): Promise<RulesConfig> => parseRules(await getSetting<unknown>("automation_rules", DEFAULT_RULES));

/** Sends a rule message once: returns true only when this call created it (the de-duplication key already stops a second copy; this tells the counts apart). */
async function sendOnce(n: Parameters<typeof notifyUser>[0] & { dedupeKey: string }): Promise<boolean> {
  const { count } = await db().from("app_notifications").select("id", { count: "exact", head: true }).eq("user_id", n.userId).eq("dedupe_key", n.dedupeKey);
  if ((count ?? 0) > 0) return false;
  return notifyUser(n);
}
async function langOf(userId: string): Promise<Lang> { const { data } = await db().from("profiles").select("lang").eq("id", userId).maybeSingle(); return isLang(data?.lang) ? data.lang : "en"; }
const arrivalOf = (a: { trips: unknown }) => { const t = a.trips as { arrival_date: string } | { arrival_date: string }[] | null; return (Array.isArray(t) ? t[0] : t)?.arrival_date ?? null; };

/**
 * The timed rules. Safe to run as often as you like: every message carries a de-duplication key (one per application and rule), and closing an application is
 * a compare-and-set that only works on the states named. One rule failing never stops the others. Called by the tick and by "Run now".
 * `opts` narrows a run to some travelers and some staff (used by the automated tests so they never touch real people).
 */
export async function runRules(now = new Date(), opts: { onlyOwners?: string[]; adminIds?: string[] } = {}): Promise<RulesRun> {
  const cfg = await loadRules();
  const out: RulesRun = { at: now.toISOString(), payment_reminders: 0, expired: 0, fix_reminders: 0, sla_warnings: 0, sla_overdue: 0 };
  const step = async (name: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { console.error(`[rules] ${name} failed`, (e as Error).message); } };

  await step("unpaid", async () => {
    if (!cfg.payment_reminder.enabled && !cfg.unpaid_expire.enabled) return;
    let q = db().from("applications").select("id, ref_no, owner_id, status, created_at, updated_at, payment_id, trips(arrival_date)").in("status", ["draft", "awaiting_payment"]).order("created_at").limit(LIMIT);
    if (opts.onlyOwners) q = q.in("owner_id", opts.onlyOwners);
    const { data } = await q;
    for (const a of data ?? []) {
      const arrival = arrivalOf(a);
      if (shouldExpire(a, arrival, cfg, now)) {
        if (a.status === "awaiting_payment" && a.payment_id) { const { data: p } = await db().from("payments").select("status").eq("id", a.payment_id).maybeSingle(); if (p?.status === "pending") continue; }          // a checkout may still be paid: the payment job decides
        const r = await db().rpc("transition_application", { p_id: a.id, p_to: "expired", p_reason: "rule: not paid in time", p_source: "system", p_actor: null, p_only_from: ["draft", "awaiting_payment"] });
        if (!r.error && (r.data as { status?: string } | null)?.status === "expired") {
          out.expired++;
          const t = DICTS[await langOf(a.owner_id)];
          await sendOnce({ userId: a.owner_id, title: t.rule_expired_title, body: fmt(t.rule_expired_body, { ref: a.ref_no }), link: "/trips", kind: "rule.expired", dedupeKey: `rule:expired:${a.id}` });
        }
      } else if (needsPaymentReminder(a, arrival, cfg, now)) {
        const t = DICTS[await langOf(a.owner_id)];
        const ok = await sendOnce({ userId: a.owner_id, title: t.rule_payrem_title, body: fmt(t.rule_payrem_body, { ref: a.ref_no }), link: "/apply", kind: "rule.payment_reminder", dedupeKey: `rule:payrem:${a.id}` });
        if (ok) out.payment_reminders++;
      }
    }
  });

  await step("fix", async () => {
    if (!cfg.fix_reminder.enabled) return;
    let q = db().from("applications").select("id, ref_no, owner_id, status, updated_at").eq("status", "action_required").order("updated_at").limit(LIMIT);
    if (opts.onlyOwners) q = q.in("owner_id", opts.onlyOwners);
    const { data } = await q;
    for (const a of data ?? []) if (needsFixReminder(a, cfg, now)) {
      const t = DICTS[await langOf(a.owner_id)];
      if (await sendOnce({ userId: a.owner_id, title: t.rule_fix_title, body: fmt(t.rule_fix_body, { ref: a.ref_no }), link: `/trips/${a.id}`, kind: "rule.fix_reminder", dedupeKey: `rule:fix:${a.id}` })) out.fix_reminders++;
    }
  });

  await step("sla", async () => {
    if (!cfg.sla_warning.enabled && !cfg.sla_overdue.enabled) return;
    const horizon = new Date(now.getTime() + cfg.sla_warning.before_hours * 3_600_000).toISOString();
    let q = db().from("applications").select("id, ref_no, sla_due_at").in("status", ["paid", "pre_check", "submitted", "under_review", "action_required"]).not("sla_due_at", "is", null).lt("sla_due_at", horizon).order("sla_due_at").limit(LIMIT);
    if (opts.onlyOwners) q = q.in("owner_id", opts.onlyOwners);
    const { data } = await q;
    if (!(data ?? []).length) return;
    const admins = opts.adminIds ? opts.adminIds.map((user_id) => ({ user_id })) : (await db().from("admins").select("user_id")).data;
    for (const a of data ?? []) {
      const level = slaLevel(a.sla_due_at, cfg, now); if (!level) continue;
      for (const ad of admins ?? []) {
        const t = DICTS[await langOf(ad.user_id)];
        const [title, body] = level === "warn" ? [t.rule_slawarn_title, fmt(t.rule_slawarn_body, { ref: a.ref_no, hours: String(hoursLeft(a.sla_due_at, now)) })] : [t.rule_late_title, fmt(t.rule_late_body, { ref: a.ref_no })];
        const ok = await sendOnce({ userId: ad.user_id, title, body, link: `/admin/queue/${a.id}`, kind: `rule.sla_${level}`, dedupeKey: `rule:sla${level}:${a.id}:${ad.user_id}` });
        if (ok) { if (level === "warn") out.sla_warnings++; else out.sla_overdue++; }
      }
    }
  });

  if (!opts.onlyOwners) await putSetting("automation_last_run", out, "00000000-0000-0000-0000-000000000000").catch(() => false);
  return out;
}

export async function lastRun(): Promise<RulesRun | null> { return (await getSetting<RulesRun | null>("automation_last_run", null)) ?? null; }
