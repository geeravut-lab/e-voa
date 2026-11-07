"use client";
import { useState } from "react";
import { voidOrderAction } from "@/app/actions/partner";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./Buttons";
import { useT } from "./I18n";
import { inputCls } from "./inputStyles";

/** "Void and refund" with a confirmation step: the refund goes back to the traveler's card and cannot be undone. */
export function VoidVoucher({ orderId }: { orderId: string }) {
  const t = useT(); const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-control px-3 py-2 text-sm font-semibold text-danger underline">{t.partner_void}</button>;
  return (
    <ActionForm action={voidOrderAction.bind(null, orderId)} className="space-y-2 rounded-control border border-danger bg-rose p-3">
      <p className="text-sm font-semibold text-danger">{t.partner_void_confirm}</p>
      <label className="block space-y-1"><span className="text-xs font-semibold">{t.partner_void_reason}</span><input name="reason" maxLength={120} className={inputCls} /></label>
      <div className="flex flex-wrap gap-2"><SubmitButton variant="danger">{t.partner_void_yes}</SubmitButton><button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-control border border-line bg-surface px-4 text-sm font-semibold">{t.partner_void_no}</button></div>
    </ActionForm>
  );
}
