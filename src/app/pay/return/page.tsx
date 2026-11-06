import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { confirmPayment } from "@/lib/payments/service";
import { AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { EditOrderButton } from "@/components/PaymentActions";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";

/** Where Stripe sends the traveler back. The result is never taken from the address: we ask Stripe (confirmPayment) and only then say "paid". */
export default async function PayReturn({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const v = await requireUser("/trips");
  const sp = await searchParams; const { t } = await getT();
  const pid = sp.payment && /^[0-9a-f-]{36}$/i.test(sp.payment) ? sp.payment : null;
  const { data: pay } = pid ? await (await createClient()).from("payments").select("id, trip_id, status, amount_thb, receipt_no").eq("id", pid).eq("owner_id", v.user.id).maybeSingle() : { data: null };
  if (!pay) return <div><PageHead title={t.pay_return_title} art="fees" tone="gold" /><p className="rounded-card bg-surface p-5 shadow-card">{t.err_not_found}</p></div>;
  const r = sp.cancelled ? null : await confirmPayment(pay.id, sp.session_id);
  const paid = r?.ok === true || ["paid", "partially_refunded", "refunded"].includes(pay.status);
  const fresh = paid ? (await (await createClient()).from("payments").select("receipt_no, amount_thb").eq("id", pay.id).maybeSingle()).data : null;
  const waiting = !paid && r && !r.ok && r.error === "pending";
  return (
    <div className="space-y-4">
      <PageHead title={t.pay_return_title} art="fees" tone={paid ? "mint" : "gold"} />
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card" role="status">
        {paid ? (
          <>
            <p className="font-display text-xl font-extrabold text-success">✓ {t.pay_paid}</p>
            {fresh?.receipt_no && <p className="text-sm">{t.receipt_no}: <b className="font-mono">{fresh.receipt_no}</b></p>}
            <p className="text-sm text-muted">{t.pay_paid_next}</p>
            <div className="flex flex-wrap gap-2"><AppLink href="/trips" className={btnClass("primary")}>{t.pay_see_trips}</AppLink><AppLink href={`/receipts/${pay.id}`} className={btnClass("ghost")}>{t.pay_see_receipt}</AppLink></div>
          </>
        ) : waiting ? (
          <><p className="font-semibold text-gold-deep">{t.pay_waiting}</p><AppLink href={`/pay/return?payment=${pay.id}${sp.session_id ? `&session_id=${sp.session_id}` : ""}`} className={btnClass("ghost")}>{t.pay_check_again}</AppLink></>
        ) : (
          <>
            <p className="font-semibold text-gold-deep">{sp.cancelled ? t.pay_cancelled : t.pay_not_completed}</p>
            <p className="text-sm text-muted">{t.pay_not_charged}</p>
            {pay.trip_id && <div className="flex flex-wrap gap-2"><AppLink href={`/apply?step=4&trip=${pay.trip_id}`} className={btnClass("primary")}>{t.pay_try_again}</AppLink><EditOrderButton paymentId={pay.id} tripId={pay.trip_id} /></div>}
          </>
        )}
      </section>
    </div>
  );
}
