import "server-only";
import { hasServiceRole } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGateway } from "@/lib/immigration/resolve";
import { SimulatedGateway } from "@/lib/immigration/simulator";
import { pollPending, processOutbox } from "@/lib/immigration/pipeline";
import { syncFlatLists } from "@/lib/immigration/sync";
import { purgeExpiredDocuments } from "@/lib/documents";
import { getSetting } from "@/lib/settings";
import { DEFAULT_RETENTION } from "@/config/defaults";
import { reconcilePaid, expireUnpaid } from "@/lib/payments/service";
import { recheckWaiting } from "@/lib/applications/service";
import { processAddonQueue, syncPartnerPackages } from "@/lib/partners/service";
import { syncWalletPasses } from "@/lib/wallet/service";
import { runRules } from "@/lib/rules/service";

const DEFAULT_BUDGET_MS = 20_000;
const budgetMs = () => { const n = Number(process.env.TICK_BUDGET_MS); return Number.isFinite(n) && n >= 1000 ? n : DEFAULT_BUDGET_MS; };          // tests on a slow link may raise it

/**
 * The timed work. Every job is idempotent and isolated: one failing never stops the others, and the whole tick stops starting new jobs
 * after the budget (20 s) (the summary says where it stopped). Called by the cron route.
 */
export async function runTick(): Promise<Record<string, unknown>> {
  const started = Date.now();
  const out: Record<string, unknown> = {};
  if (!hasServiceRole()) return { skipped: "service role not configured" };
  const gw = await resolveGateway();

  const jobs: [string, () => Promise<unknown>][] = [
    ["payments", async () => ({ reconciled: await reconcilePaid(), expired: await expireUnpaid() })],
    ["pre_check", async () => recheckWaiting()],
    ["addons", async () => processAddonQueue()],
    ["rules", async () => runRules()],
    ["wallet", async () => syncWalletPasses()],
    ["partner_packages", async () => {
      const { data } = await createAdminClient().from("partner_packages").select("synced_at").order("synced_at", { ascending: true }).limit(1);
      const last = data?.[0]?.synced_at ? Date.parse(data[0].synced_at) : 0;
      return Date.now() - last > 20 * 3600_000 ? syncPartnerPackages() : "fresh";
    }],
    ["outbox", async () => (gw ? processOutbox(gw) : "gateway not configured")],
    ["poll", async () => (gw ? pollPending(gw) : "gateway not configured")],
    ["master_sync", async () => {
      if (!gw || gw instanceof SimulatedGateway) return "gateway not configured";          // the simulator has no lists; keep what is loaded
      const { data } = await createAdminClient().from("master_sync").select("last_synced_at").order("last_synced_at", { ascending: true, nullsFirst: true }).limit(1);
      const oldest = data?.[0]?.last_synced_at ? Date.parse(data[0].last_synced_at) : 0;
      return Date.now() - oldest > 20 * 3600_000 ? syncFlatLists(gw) : "fresh";
    }],
    ["housekeeping", async () => {
      const db = createAdminClient(); const day = 86_400_000, iso = (ms: number) => new Date(Date.now() - ms).toISOString();
      await db.from("rate_limits").delete().lt("window_start", iso(day));
      await db.from("error_log").delete().lt("at", iso(30 * day));
      await db.from("form_drafts").delete().lt("updated_at", iso(30 * day));
      return "ok";
    }],
    ["purge", async () => {
      const r = await getSetting("retention", DEFAULT_RETENTION);
      return purgeExpiredDocuments(r.document_days ?? DEFAULT_RETENTION.document_days);
    }],
  ];
  for (const [name, job] of jobs) {
    if (Date.now() - started > budgetMs()) { out[name] = "not started: time budget used"; continue; }
    try { out[name] = await job(); } catch (e) { console.error(`[tick] ${name} failed`, (e as Error).message); out[name] = { error: (e as Error).message.slice(0, 200) }; }
  }
  out.ms = Date.now() - started;
  return out;
}
