"use client";
import { simulateDecisionAction } from "@/app/actions/immigration";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./Buttons";
import { useT } from "./I18n";
import { inputCls } from "./inputStyles";

/** Test mode only: plays Immigration's answer for an application that was sent to the built-in simulator. */
export function SimulateDecision({ appId }: { appId: string }) {
  const t = useT();
  const form = (decision: "approve" | "reject" | "update", label: string, variant: "primary" | "ghost" | "danger", withReason: boolean) => (
    <ActionForm action={simulateDecisionAction.bind(null, appId, decision)} className="space-y-2">
      {withReason && <input name="reason" maxLength={200} className={inputCls} aria-label={t.ops_sim_reason} placeholder={t.ops_sim_reason} />}
      <SubmitButton variant={variant} className="w-full">{label}</SubmitButton>
    </ActionForm>
  );
  return <div className="space-y-3">{form("approve", t.ops_sim_approve, "primary", false)}{form("update", t.ops_sim_update, "ghost", true)}{form("reject", t.ops_sim_reject, "danger", true)}</div>;
}
