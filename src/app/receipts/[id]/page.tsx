import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { PrintButton } from "@/components/PrintButton";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";
const thb = (n: number) => `THB ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireUser("/trips");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { t, lang, brandName } = await getT();
  const db = await createClient();
  const { data: p } = await db.from("payments").select("id, receipt_no, status, amount_thb, refunded_thb, items, paid_at, provider, trip_id").eq("id", id).eq("owner_id", v.user.id).maybeSingle();
  if (!p || !p.receipt_no) notFound();
  const { data: refunds } = await db.from("refunds").select("id, amount_thb, reason, created_at, status").eq("payment_id", p.id).eq("status", "succeeded").order("created_at");
  const items = (Array.isArray(p.items) ? p.items : []) as { label: string; amountThb: number }[];
  const when = new Intl.DateTimeFormat(lang, { dateStyle: "long", timeStyle: "short" });
  return (
    <div className="space-y-4">
      <div className="print:hidden"><PageHead title={t.receipt_title} art="fees" tone="gold" /></div>
      <article className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card print:shadow-none">
        <header className="flex flex-wrap items-baseline justify-between gap-2"><b className="font-display text-xl">{brandName}</b><span className="font-mono font-bold">{p.receipt_no}</span></header>
        {p.paid_at && <p className="text-sm text-muted">{when.format(new Date(p.paid_at))}</p>}
        <table className="w-full text-sm tabular"><tbody className="divide-y divide-line">
          {items.map((i, n) => <tr key={n}><td className="py-2 pe-2">{i.label}</td><td className="py-2 text-end">{thb(i.amountThb)}</td></tr>)}
          <tr className="font-bold"><td className="py-2">{t.pay_total}</td><td className="py-2 text-end">{thb(Number(p.amount_thb))}</td></tr>
          {(refunds ?? []).map((r) => <tr key={r.id} className="text-success"><td className="py-2">{t.receipt_refund} · {when.format(new Date(r.created_at))}</td><td className="py-2 text-end">− {thb(Number(r.amount_thb))}</td></tr>)}
        </tbody></table>
        <p className="text-xs text-muted">{t.receipt_note}</p>
      </article>
      <div className="flex flex-wrap gap-2 print:hidden"><a href={`/receipts/${p.id}/pdf`} className={btnClass("gold")}>{t.receipt_pdf}</a><AppLink href={`/receipts/${p.id}/invoice`} className={btnClass("ghost")}>{t.invoice_title}</AppLink><PrintButton /><AppLink href="/trips" className={btnClass("ghost")}>{t.back}</AppLink></div>
    </div>
  );
}
