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
  const a = await requireAdminAction(); if (!a.ok) return a;
  const gw = gatewayFromEnv(); if (!gw) return { ok: false, error: "err_not_configured" };
  const t0 = Date.now();
  try { await gw.master("gender"); } catch (e) { return { ok: false, error: code(e) }; }
  const { t } = await getT();
  return { ok: true, message: fmt(t.imm_test_ok, { ms: Date.now() - t0 }) };
}

export async function syncListsAction(): Promise<ActionResult> {
  const a = await requireAdminAction(); if (!a.ok) return a;
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
  const a = await requireAdminAction(); if (!a.ok) return a;
  const gw = gatewayFromEnv(); if (!gw) return { ok: false, error: "err_not_configured" };
  try {
    const r = await syncChildLists(gw);
    await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "immigration.sync_districts", entity: "master_data", detail: { rows: r.rows, failed: r.failed } });
    revalidatePath("/admin/immigration");
    const { t } = await getT();
    return { ok: true, message: fmt(t.imm_sync_done, { rows: r.rows }) };
  } catch (e) { return { ok: false, error: code(e) }; }
}
