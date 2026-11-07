import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { PageHead } from "@/components/PageHead";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { limited } from "@/lib/ratelimit";
import { loadPayerView } from "@/lib/paylink/service";
import { payViaLinkAction } from "@/app/actions/paylink";

export const dynamic = "force-dynamic";
// The secret is in the address: never indexed, never sent on as a referrer.
export const metadata: Metadata = { title: "Pay", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Public page for a pay-later link. The person needs no account; they see who asked, first names, the date and the price, and nothing about passports. */
export default async function PayLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t, lang } = await getT();
  const m = t as unknown as Record<string, string>;
  const view = (await limited("paylink-view", 60, 600)) ? ({ ok: false, state: "invalid" } as const) : await loadPayerView(token);
  const money = (n: number) => `THB ${n.toLocaleString("en-US")}`;
  const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card";
  if (!view.ok) return <div className="space-y-4"><PageHead title={t.paylink_page_title} art="fees" tone="gold" /><p role="alert" className={`${box} font-semibold text-gold-deep`}>{m[`paylink_state_${view.state}`] ?? t.paylink_state_invalid}</p></div>;
  if (view.state === "paid") return <div className="space-y-4"><PageHead title={t.paylink_page_title} art="fees" tone="mint" /><p role="status" className={`${box} font-semibold text-success`}>✓ {t.paylink_state_paid}</p></div>;
  const p = view.payer, by = p.by || t.paylink_someone;
  const date = p.arrival ? new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${p.arrival}T00:00:00Z`)) : null;
  return (
    <div className="space-y-4">
      <PageHead title={t.paylink_page_title} hint={t.paylink_page_hint.replace("{by}", by)} art="fees" tone="gold" />
      <section className={box}>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-muted">{t.paylink_for}</dt><dd className="font-semibold">{p.names.join(", ")}</dd></div>
          {date && <div><dt className="text-xs text-muted">{t.paylink_arrival}</dt><dd className="font-semibold">{date}</dd></div>}
        </dl>
        <ul className="divide-y divide-line text-sm">{p.lines.map((l, i) => <li key={i} className="flex justify-between gap-3 py-2"><span>{l.label}</span><span className="tabular">{money(l.thb)}</span></li>)}</ul>
        <p className="flex justify-between border-t border-line pt-3 font-display text-lg font-extrabold"><span>{t.paylink_total}</span><span className="tabular">{money(p.totalThb)}</span></p>
        <ActionForm action={payViaLinkAction.bind(null, token)}><SubmitButton variant="gold" className="w-full">{t.paylink_pay} · {money(p.totalThb)}</SubmitButton></ActionForm>
        <p className="text-xs text-muted">{t.paylink_fine}</p>
      </section>
    </div>
  );
}
