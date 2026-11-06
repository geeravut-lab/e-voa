"use client";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { useState } from "react";
import { cancelApplicationByTravelerAction, resubmitAction, upgradeAction } from "@/app/actions/apply";

/** After fixing what was asked for: send the application on again. */
export function ResubmitForm({ appId }: { appId: string }) {
  const t = useT();
  return <ActionForm action={resubmitAction}><input type="hidden" name="appId" value={appId} /><SubmitButton variant="gold">{t.trip_resubmit}</SubmitButton></ActionForm>;
}


/** Cancel an application: the cost (visa and service fee stay) is stated first and must be accepted with a tick. */
export function CancelPanel({ appId }: { appId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-sm font-semibold text-danger">{t.cancel_open}</button>;
  return (
    <ActionForm action={cancelApplicationByTravelerAction} className="space-y-3 rounded-control border border-danger p-3">
      <input type="hidden" name="appId" value={appId} />
      <p className="text-sm font-semibold">{t.cancel_warning}</p>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="understand" className="mt-1 h-5 w-5" /><span>{t.cancel_understand}</span></label>
      <div className="flex flex-wrap gap-2"><SubmitButton variant="danger">{t.cancel_confirm}</SubmitButton><button type="button" onClick={() => setOpen(false)} className="min-h-11 px-3 text-sm font-semibold text-primary">{t.cancel_keep}</button></div>
    </ActionForm>
  );
}

export function UpgradeForm({ appId, diffLabel }: { appId: string; diffLabel: string }) {
  const t = useT();
  return <ActionForm action={upgradeAction} className="space-y-2"><input type="hidden" name="appId" value={appId} /><p className="text-sm">{t.upgrade_text}</p><SubmitButton variant="gold">{t.upgrade_button} · {diffLabel}</SubmitButton></ActionForm>;
}
