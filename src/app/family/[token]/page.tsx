import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { famText, fam } from "@/lib/family/text";
import { loadContactView } from "@/lib/family/service";
import { limited } from "@/lib/ratelimit";
import { acceptContactAction, leaveContactAction } from "@/app/actions/family";
import { PageHead } from "@/components/PageHead";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";

export const dynamic = "force-dynamic";
// The secret is in the address: never indexed, never sent on as a referrer.
export const metadata: Metadata = { title: "Safety check-in", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** What a relative sees through their link. No account. Only the first name, the time and the status of the last check-in; never a position. */
export default async function FamilyContactPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t, lang } = await getT(); const f = famText(lang);
  const view = (await limited("family-view", 60, 600)) ? ({ ok: false, state: "invalid" } as const) : await loadContactView(token);
  const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card";
  const head = <PageHead title={f.v_title} art="emergency" tone="rose" />;
  if (!view.ok) return <div className="space-y-4">{head}<p role="alert" className={`${box} font-semibold text-gold-deep`}>{view.state === "ended" ? f.v_ended : f.v_invalid}</p></div>;
  const name = view.ownerName, ago = (iso: string) => new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(iso));
  if (view.state === "pending") return (
    <div className="space-y-4">{head}
      <section className={box}><p>{fam(f.v_pending, { name })}</p>
        <ActionForm action={acceptContactAction.bind(null, token, name)}><SubmitButton variant="primary">{f.v_accept}</SubmitButton></ActionForm>
        <ActionForm action={leaveContactAction.bind(null, token)}><SubmitButton variant="ghost">{f.v_decline}</SubmitButton></ActionForm></section>
      <p className="text-xs text-muted">{f.v_note}</p>
    </div>
  );
  return (
    <div className="space-y-4">{head}
      <section className={box} role="status">
        <h2 className="font-display text-xl font-bold">{name}</h2>
        {view.last ? <p className="text-lg"><b>{f.v_last}:</b> <span className="tabular">{ago(view.last.at)}</span> — <span className={view.last.status === "help" ? "font-bold text-danger" : "font-bold text-success"}>{view.last.status === "help" ? f.v_help : f.v_safe}</span></p> : <p>{fam(f.v_never, { name })}</p>}
        <p className={`rounded-control p-3 text-sm font-semibold ${view.overdue || view.last?.status === "help" ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}>{view.overdue ? f.v_overdue : f.v_ok}</p>
      </section>
      <section className={box}><p className="text-sm">{f.v_todo}</p>
        <p className="flex flex-wrap gap-2"><a href="tel:1155" className="inline-flex min-h-11 items-center rounded-control bg-danger px-4 font-bold text-white">☎ 1155</a><a href="tel:191" className="inline-flex min-h-11 items-center rounded-control bg-danger px-4 font-bold text-white">☎ 191</a></p></section>
      <ActionForm action={leaveContactAction.bind(null, token)}><SubmitButton variant="ghost">{f.v_leave}</SubmitButton></ActionForm>
      <p className="text-xs text-muted">{f.v_note}</p>
      <p className="hidden">{t.app_name}</p>
    </div>
  );
}
