"use client";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { resubmitAction } from "@/app/actions/apply";

/** After fixing what was asked for: send the application on again. */
export function ResubmitForm({ appId }: { appId: string }) {
  const t = useT();
  return <ActionForm action={resubmitAction}><input type="hidden" name="appId" value={appId} /><SubmitButton variant="gold">{t.trip_resubmit}</SubmitButton></ActionForm>;
}
