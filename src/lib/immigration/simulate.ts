import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleStatusCallback } from "./pipeline";
import { resolveGateway, simulatorActive } from "./resolve";
import { isSimulatedRef, simulatedEvoaPdf } from "./simulator";

/**
 * Plays Immigration's answer for an application that was sent to the SIMULATOR (its reference starts with SIM-). It goes through exactly the code a real callback goes through.
 * Refused for anything else: a real application, or any application while the simulator is off, can never get a simulated decision.
 */
export async function simulateDecision(appId: string, decision: "approve" | "reject" | "update", reasonRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await simulatorActive()) || !/^[0-9a-f-]{36}$/i.test(appId)) return { ok: false, error: "err_forbidden" };
  const { data: app } = await createAdminClient().from("applications").select("id, status, immigration_ref, batch_reference").eq("id", appId).maybeSingle();
  if (!app || !isSimulatedRef(app.immigration_ref) || !app.batch_reference || !["submitted", "under_review"].includes(app.status)) return { ok: false, error: "err_bad_transition" };
  const reason = reasonRaw.trim().slice(0, 200) || (decision === "reject" ? "Simulated rejection" : decision === "update" ? "Simulated request for more information" : "Simulated approval");
  const evoaContent = decision === "approve" ? (await simulatedEvoaPdf(app.immigration_ref!)).toString("base64") : undefined;
  const r = await handleStatusCallback({ batchReference: app.batch_reference, webReferenceNumber: app.immigration_ref!, statusId: decision === "approve" ? 1 : decision === "reject" ? 2 : 3, statusDesc: reason, ...(evoaContent ? { evoaContent } : {}) }, await resolveGateway());
  return r.isSuccess ? { ok: true } : { ok: false, error: "err_bad_transition" };
}
