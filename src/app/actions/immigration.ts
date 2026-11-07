"use server";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { gatewayFromEnv, ImmigrationError } from "@/lib/immigration/gateway";
import { syncChildLists, syncFlatLists } from "@/lib/immigration/sync";
import { fmt } from "@/lib/i18n/dict";
import { getT } from "@/lib/i18n/server";
import type { ActionResult } from "@/components/ActionForm";

const code = (e: unknown) => (e instanceof ImmigrationError ? (e.kind === "auth" ? "err_immigration_auth" : e.kind === "unavailable" ? "err_immigration_down" : "err_immigration_unexpected") : "err_generic");

export async function testImmigrationAction(): Promise<ActionResult> {
  const a = await requireAdminAction("config"); if (!a.ok) return a;
  const gw = gatewayFromEnv(); if (!gw) return { ok: false, error: "err_not_configured" };
  const t0 = Date.now();
  try { await gw.master("gender"); } catch (e) { return { ok: false, error: code(e) }; }
  const { t } = await getT();
  return { ok: true, message: fmt(t.imm_test_ok, { ms: Date.now() - t0 }) };
}

export async function syncListsAction(): Promise<ActionResult> {
  const a = await requireAdminAction("config"); if (!a.ok) return a;
  const gw = gatewayFromEnv(); if (!gw) return { ok: false, error: "err_not_configured" };
  try {
    const r = await syncFlatLists(gw);
    await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "immigration.sync_lists", entity: "master_data", detail: { rows: r.rows, failed: r.failed.length } });
    revalidatePath("/admin/immigration");
    const { t } = await getT();
    return { ok: true, message: r.failed.length ? fmt(t.imm_sync_partial, { rows: r.rows, failed: r.failed.join(", ") }) : fmt(t.imm_sync_done, { rows: r.rows }) };
  } catch (e) { return { ok: false, error: code(e) }; }
}

export async function syncDistrictsAction(): Promise<ActionResult> {
  const a = await requireAdminAction("config"); if (!a.ok) return a;
  const gw = gatewayFromEnv(); if (!gw) return { ok: false, error: "err_not_configured" };
  try {
    const r = await syncChildLists(gw);
    await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "immigration.sync_districts", entity: "master_data", detail: { rows: r.rows, failed: r.failed } });
    revalidatePath("/admin/immigration");
    const { t } = await getT();
    return { ok: true, message: fmt(t.imm_sync_done, { rows: r.rows }) };
  } catch (e) { return { ok: false, error: code(e) }; }
}

// ------------------------------------------------------------------ the built-in Immigration simulator (for trying the journey before the real API exists)
import { putSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGateway, simulatorActive } from "@/lib/immigration/resolve";
import { gatewayFromEnv as realGateway } from "@/lib/immigration/gateway";
import { simulateDecision } from "@/lib/immigration/simulate";
import { pollPending, processOutbox } from "@/lib/immigration/pipeline";

export async function saveSimAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config"); if (!a.ok) return a;
  const enabled = fd.get("enabled") === "on";
  if (enabled && realGateway()) return { ok: false, error: "err_sim_real_connected" };          // a real connection always wins
  if (!(await putSetting("immigration_sim", { enabled }, a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.immigration_sim", entity: "settings", detail: { enabled } });
  revalidatePath("/admin/immigration"); revalidatePath("/", "layout");
  return { ok: true };
}

/** "Send now": applications waiting in the queue are sent right away instead of at the next scheduled run (the retry waiting time is skipped). */
export async function runQueueNowAction(): Promise<ActionResult> {
  const a = await requireAdminAction("config"); if (!a.ok) return a;
  const gw = await resolveGateway(); if (!gw) return { ok: false, error: "err_not_configured" };
  const db = createAdminClient();
  await db.from("immigration_outbox").update({ next_attempt_at: new Date().toISOString() }).eq("status", "pending");
  const r = await processOutbox(gw, 25);
  const p = await pollPending(gw, 0, 25).catch(() => ({ checked: 0, changed: 0 }));
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "immigration.queue_now", entity: "immigration_outbox", detail: { sent: r.sent, refused: r.refused, retry: r.retry } });
  revalidatePath("/admin/immigration"); revalidatePath("/admin/queue", "layout");
  const { t } = await getT();
  return { ok: true, message: fmt(t.imm_queue_done, { sent: r.sent, refused: r.refused, retry: r.retry }) };
}

/** Plays Immigration's answer for an application that was sent to the SIMULATOR (see lib/immigration/simulate.ts). */
export async function simulateDecisionAction(appId: string, decision: "approve" | "reject" | "update", _p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config"); if (!a.ok) return a;
  const r = await simulateDecision(appId, decision, String(fd.get("reason") ?? ""));
  if (!r.ok) return r;
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "immigration.simulated_decision", entity: "application", entityId: appId, detail: { decision } });
  revalidatePath(`/admin/queue/${appId}`); revalidatePath("/admin/queue");
  return { ok: true };
}
