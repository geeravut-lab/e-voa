import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { confirmPayment } from "@/lib/payments/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { limited } from "@/lib/ratelimit";
import { AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thank you", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Where Stripe sends a pay-later payer. As on the traveler's own return page, "paid" comes from asking Stripe (confirmPayment), never from the address. Shows no personal data. */
export default async function PayThanks({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams; const { t } = await getT();
  const pid = sp.payment && /^[0-9a-f-]{36}$/i.test(sp.payment) ? sp.payment : null;
  const blocked = await limited("paylink-thanks", 30, 600);
  const { data: pay } = pid && !blocked ? await createAdminClient().from("payments").select("id, status").eq("id", pid).maybeSingle() : { data: null };
  const r = pay && !sp.cancelled ? await confirmPayment(pay.id, sp.session_id) : null;
  const paid = r?.ok === true || (!!pay && ["paid", "partially_refunded", "refunded"].includes(pay.status));
  const waiting = !paid && !!r && !r.ok && r.error === "pending";
  const back = `/pay/thanks?payment=${pid}${sp.session_id ? `&session_id=${encodeURIComponent(sp.session_id)}` : ""}`;
  return (
    <div className="space-y-4">
      <PageHead title={t.paylink_thanks_title} art="fees" tone={paid ? "mint" : "gold"} />
      <section role="status" className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        {!pay ? <p className="font-semibold text-gold-deep">{t.paylink_state_invalid}</p>
          : paid ? <p className="font-display text-xl font-extrabold text-success">✓ {t.paylink_thanks_paid}</p>
          : waiting ? <><p className="font-semibold text-gold-deep">{t.paylink_thanks_wait}</p><AppLink href={back} className={btnClass("ghost")}>{t.paylink_check_again}</AppLink></>
          : <p className="font-semibold text-gold-deep">{t.paylink_thanks_cancelled}</p>}
      </section>
    </div>
  );
}
