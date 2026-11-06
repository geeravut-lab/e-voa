import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { companyReady } from "@/lib/invoice";
import { loadCompany } from "@/lib/invoice-service";
import { requestInvoiceAction } from "@/app/actions/public";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { btnClass } from "@/components/buttonStyles";
import { inputCls } from "@/components/apply/fields";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireUser("/trips");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { t } = await getT();
  const db = await createClient();
  const { data: pay } = await db.from("payments").select("id, receipt_no, status").eq("id", id).eq("owner_id", v.user.id).maybeSingle();
  if (!pay?.receipt_no) notFound();
  const { data: inv } = await db.from("tax_invoices").select("invoice_no, buyer").eq("payment_id", id).maybeSingle();
  const ready = companyReady(await loadCompany());
  return (
    <div className="space-y-4">
      <PageHead title={t.invoice_title} hint={pay.receipt_no} art="fees" tone="gold" />
      {inv ? (
        <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
          <p className="font-semibold">{t.invoice_issued}: <span className="font-mono">{inv.invoice_no}</span></p>
          <a href={`/receipts/${id}/invoice/pdf`} className={btnClass("gold", "w-full")}>{t.receipt_pdf}</a>
        </section>
      ) : !ready ? (
        <p role="status" className="rounded-card border border-line bg-surface p-5 text-muted shadow-card">{t.invoice_not_ready}</p>
      ) : (
        <ActionForm action={requestInvoiceAction} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
          <input type="hidden" name="paymentId" value={id} />
          <p className="text-sm text-muted">{t.invoice_hint}</p>
          <label className="block space-y-1"><span className="text-sm font-semibold">{t.invoice_buyer_name}</span><input name="name" required minLength={2} maxLength={120} className={inputCls} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold">{t.invoice_buyer_address}</span><textarea name="address" rows={3} maxLength={300} className={inputCls} /></label>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <label className="block space-y-1"><span className="text-sm font-semibold">{t.invoice_buyer_tax}</span><input name="tax_id" maxLength={20} className={`${inputCls} font-mono`} /></label>
            <label className="block space-y-1"><span className="text-sm font-semibold">{t.invoice_buyer_branch}</span><input name="branch" maxLength={10} className={`${inputCls} font-mono`} /></label>
          </div>
          <SubmitButton className="w-full">{t.invoice_issue}</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
