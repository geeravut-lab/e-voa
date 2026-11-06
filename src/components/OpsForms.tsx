"use client";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { inputCls } from "@/components/apply/fields";
import { addNoteAction, requestFixAction, retrySendAction, cancelApplicationAction, refundExceptionAction, refundAddonAction, retryAddonAction } from "@/app/actions/ops";

const hid = (appId: string) => <input type="hidden" name="appId" value={appId} />;

export function NoteForm({ appId }: { appId: string }) {
  const t = useT();
  return <ActionForm action={addNoteAction} className="space-y-2">{hid(appId)}<textarea name="body" required maxLength={1000} rows={2} className={inputCls} aria-label={t.ops_note} placeholder={t.ops_note} /><SubmitButton variant="ghost">{t.ops_add_note}</SubmitButton></ActionForm>;
}
export function RequestFixForm({ appId }: { appId: string }) {
  const t = useT();
  return <ActionForm action={requestFixAction} className="space-y-2">{hid(appId)}<input name="reason" required maxLength={300} className={inputCls} aria-label={t.ops_fix_reason} placeholder={t.ops_fix_reason} /><SubmitButton variant="gold">{t.ops_request_fix}</SubmitButton></ActionForm>;
}
export function RetrySendForm({ appId }: { appId: string }) {
  const t = useT();
  return <ActionForm action={retrySendAction}>{hid(appId)}<SubmitButton>{t.ops_retry_send}</SubmitButton></ActionForm>;
}
export function CancelForm({ appId }: { appId: string }) {
  const t = useT();
  return <ActionForm action={cancelApplicationAction} className="space-y-2">{hid(appId)}<input name="reason" maxLength={200} className={inputCls} aria-label={t.ops_cancel_reason} placeholder={t.ops_cancel_reason} /><SubmitButton variant="danger">{t.ops_cancel}</SubmitButton></ActionForm>;
}
export function RefundExceptionForm({ appId, paymentId, max }: { appId: string; paymentId: string; max: number }) {
  const t = useT();
  return (
    <ActionForm action={refundExceptionAction} className="space-y-2">{hid(appId)}<input type="hidden" name="paymentId" value={paymentId} />
      <div className="grid grid-cols-[8rem_1fr] gap-2"><input name="amount" type="number" step="0.01" min="0.01" max={max} required className={inputCls} aria-label={t.ops_refund_amount} placeholder={t.ops_refund_amount} /><input name="reason" required minLength={3} maxLength={200} className={inputCls} aria-label={t.ops_refund_reason} placeholder={t.ops_refund_reason} /></div>
      <SubmitButton variant="danger">{t.ops_refund_exception}</SubmitButton></ActionForm>
  );
}
export function AddonOpsForms({ appId, orderId, status }: { appId: string; orderId: string; status: string }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {status === "failed" && <ActionForm action={retryAddonAction}>{hid(appId)}<input type="hidden" name="orderId" value={orderId} /><SubmitButton variant="ghost">{t.ops_addon_retry}</SubmitButton></ActionForm>}
      {["paid", "issuing", "issued", "failed"].includes(status) && <ActionForm action={refundAddonAction}>{hid(appId)}<input type="hidden" name="orderId" value={orderId} /><SubmitButton variant="ghost">{t.ops_addon_refund}</SubmitButton></ActionForm>}
    </div>
  );
}
