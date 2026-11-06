"use client";
import { useRouter } from "next/navigation";
import { AsyncButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { cancelPaymentAction } from "@/app/actions/apply";

/** Back to editing an order that was not paid: closes the open payment so the applications become editable drafts again. */
export function EditOrderButton({ paymentId, tripId }: { paymentId: string; tripId: string }) {
  const t = useT(); const router = useRouter();
  return <AsyncButton variant="ghost" onClick={async () => { await cancelPaymentAction(paymentId); router.push(`/apply?step=2&trip=${tripId}`); }}>{t.pay_edit_order}</AsyncButton>;
}
