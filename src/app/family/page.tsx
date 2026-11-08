import { pageMeta } from "@/lib/seo";
import { getT, getLang } from "@/lib/i18n/server";
import { getViewer } from "@/lib/auth";
import { famText, fam } from "@/lib/family/text";
import { INTERVALS, MAX_CONTACTS } from "@/lib/family/rules";
import { loadOwnerState } from "@/lib/family/service";
import { saveScheduleAction, inviteContactAction, resendInviteAction, removeContactAction } from "@/app/actions/family";
import { PageHead } from "@/components/PageHead";
import { AppLink } from "@/components/AppLink";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { CheckInButtons } from "@/components/CheckInButtons";
import { btnClass } from "@/components/buttonStyles";
import { inputCls } from "@/components/inputStyles";

export const generateMetadata = () => pageMeta({ path: "/family", title: "tk_family", description: "tk_family_sub" });
export const dynamic = "force-dynamic";
const when = (iso: string, lang: string) => new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(iso));

export default async function FamilyPage() {
  const { t } = await getT(); const lang = await getLang(), f = famText(lang), v = await getViewer();
  const head = <PageHead title={t.tk_family} hint={f.hint} art="emergency" tone="rose" />;
  if (!v.user) return <div className="space-y-4">{head}<section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card"><p>{f.signin}</p><AppLink href="/login?next=/family" className={btnClass("primary")}>{t.nav_signin}</AppLink></section></div>;
  const { contacts, schedule, checkins } = await loadOwnerState(v.user.id);
  const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card", last = checkins[0];
  const sched = schedule ?? { enabled: false, interval_hours: 24, grace_hours: 2, until_date: null, next_due_at: null };
  const status = (c: { confirmed_at: string | null }) => (c.confirmed_at ? <span className="font-semibold text-success">✓ {f.c_accepted}</span> : <span className="font-semibold text-gold-deep">{f.c_pending}</span>);
  return (
    <div className="space-y-4">
      {head}
      <section className={box}>
        <p className="text-sm text-muted" role="status">{last ? fam(f.checked, { time: when(last.at, lang) }) : f.never}{sched.enabled && sched.next_due_at ? ` · ${fam(f.next_due, { time: when(sched.next_due_at, lang) })}` : ""}</p>
        <CheckInButtons w={{ safe: f.safe_btn, help: f.help_btn, helpTitle: f.help_title, helpText: f.help_text, helpPos: f.help_pos, helpSend: f.help_send, cancel: f.help_cancel }} />
      </section>
      <section className={box}>
        <h2 className="font-display text-lg font-bold">{f.sched_title}</h2><p className="text-sm text-muted">{f.sched_hint}</p>
        <ActionForm action={saveScheduleAction} className="space-y-3">
          <label className="flex min-h-11 items-start gap-3 text-sm font-semibold"><input type="checkbox" name="enabled" defaultChecked={sched.enabled} className="mt-0.5 h-5 w-5" />{f.sched_on}</label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1 text-sm font-semibold">{f.sched_every}<select name="interval" defaultValue={sched.interval_hours} className={inputCls}>{INTERVALS.map((n) => <option key={n} value={n}>{fam(f.sched_hours, { n })}</option>)}</select></label>
            <label className="block space-y-1 text-sm font-semibold">{f.sched_grace}<select name="grace" defaultValue={sched.grace_hours} className={inputCls}>{[1, 2, 4, 6, 12].map((n) => <option key={n} value={n}>{fam(f.sched_hours, { n })}</option>)}</select></label>
            <label className="block space-y-1 text-sm font-semibold">{f.sched_until}<input type="date" name="until" defaultValue={sched.until_date ?? ""} className={inputCls} /></label>
          </div>
          <SubmitButton>{f.sched_save}</SubmitButton>
        </ActionForm>
      </section>
      <section className={box}>
        <h2 className="font-display text-lg font-bold">{f.contacts_title}</h2><p className="text-sm text-muted">{f.contacts_hint}</p>
        {contacts.length === 0 ? <p className="text-sm text-muted">{f.c_none}</p> : (
          <ul className="space-y-2">{contacts.map((c) => (
            <li key={c.id} className="space-y-2 rounded-control border border-line p-3"><p className="font-semibold">{c.name} <span className="font-normal text-muted">· {c.email}</span></p><p className="text-sm">{status(c)}</p>
              <div className="flex flex-wrap gap-2"><ActionForm action={resendInviteAction.bind(null, c.id)}><SubmitButton variant="ghost">{f.c_resend}</SubmitButton></ActionForm><ActionForm action={removeContactAction.bind(null, c.id)}><SubmitButton variant="ghost">{f.c_remove}</SubmitButton></ActionForm></div></li>))}</ul>
        )}
        {contacts.length < MAX_CONTACTS && (
          <ActionForm action={inviteContactAction} className="space-y-3 rounded-control bg-sky p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-semibold">{f.c_name}<input name="name" required maxLength={60} className={inputCls} autoComplete="off" /></label>
              <label className="block space-y-1 text-sm font-semibold">{f.c_email}<input name="email" type="email" required maxLength={160} className={inputCls} autoComplete="off" /></label>
            </div>
            <label className="block space-y-1 text-sm font-semibold">{f.c_lang}<select name="lang" defaultValue={lang === "th" || lang === "zh-CN" ? lang : "en"} className={inputCls}><option value="en">English</option><option value="th">ไทย</option><option value="zh-CN">简体中文</option></select></label>
            <p className="text-xs text-muted">{f.lang_note}</p>
            <SubmitButton>{f.c_add}</SubmitButton>
          </ActionForm>
        )}
      </section>
      {checkins.length > 0 && (
        <section className={box}><h2 className="font-display text-lg font-bold">{f.history}</h2>
          <ul className="divide-y divide-line text-sm">{checkins.map((c) => <li key={c.id} className="flex justify-between gap-3 py-2"><span className={c.status === "help" ? "font-semibold text-danger" : ""}>{c.status === "help" ? f.h_help : f.h_safe}</span><span className="tabular text-muted">{when(c.at, lang)}</span></li>)}</ul></section>
      )}
      <p className="text-xs text-muted">{f.privacy}</p>
      <div className="flex flex-wrap gap-2"><AppLink href="/emergency" className={btnClass("ghost")}>{t.card_emergency}</AppLink><AppLink href="/toolkit" className={btnClass("ghost")}>{t.card_toolkit}</AppLink></div>
    </div>
  );
}
