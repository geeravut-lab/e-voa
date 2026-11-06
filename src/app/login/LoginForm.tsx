"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/I18n";
import { AsyncButton } from "@/components/Buttons";
import { Spinner } from "@/components/Spinner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function LoginForm({ next, google, line, email: emailOn, hubUrl, appSlug }: { next: string; google: boolean; line: boolean; email: boolean; hubUrl: string; appSlug: string }) {
  const t = useT();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [lineBusy, setLineBusy] = useState(false);

  const supabase = () => createClient();
  const done = async () => { window.location.assign(next); await new Promise(() => {}); };   // hard navigation: the next request must carry the new session cookie

  const signInGoogle = async () => {
    setError(null);
    const { error: e } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (e) { console.error("[login] google", e.message); setError(t.login_failed); }
    else await new Promise(() => {}); // the browser is leaving for Google: keep the spinner until it does
  };

  const signIn = async () => {
    setError(null); setInfo(null);
    if (!EMAIL_RE.test(email.trim())) return setError(t.err_email_invalid);
    if (!password) return setError(t.err_password_missing);
    const { error: e } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (e) { console.error("[login] password", e.message); return setError(t.err_password_wrong); }
    await done();
  };

  const signUp = async () => {
    setError(null); setInfo(null);
    if (!EMAIL_RE.test(email.trim())) return setError(t.err_email_invalid);
    if (password.length < MIN_PASSWORD) return setError(t.err_password_short);
    if (password !== again) return setError(t.err_password_mismatch);
    const { data, error: e } = await supabase().auth.signUp({ email: email.trim(), password });
    if (e) { console.error("[login] sign up", e.message); return setError(/registered|exists/i.test(e.message) ? t.err_email_taken : t.login_failed); }
    if (data.session) return done();
    // No session: this e-mail already has an account (Supabase does not say so), or e-mail confirmation is switched on again.
    const r = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (!r.error) return done();
    setError(t.err_email_taken);
  };

  const forgot = async () => {
    setError(null); setInfo(null);
    if (!EMAIL_RE.test(email.trim())) return setError(t.err_email_invalid);
    const { error: e } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/account/password")}` });
    if (e) { console.error("[login] reset", e.message); return setError(t.login_failed); }
    setInfo(t.login_reset_sent.replace("{email}", email.trim()));
  };

  const lineHref = `${hubUrl}/sso/authorize?app=${encodeURIComponent(appSlug)}&return=${encodeURIComponent(`${typeof window === "undefined" ? "" : window.location.origin}/sso/callback?next=${encodeURIComponent(next)}`)}`;
  const input = "min-h-11 w-full rounded-control border-[1.5px] border-field bg-surface px-3";
  const switchTo = (m: typeof mode) => { setMode(m); setError(null); setInfo(null); setPassword(""); setAgain(""); };

  return (
    <div className="space-y-4">
      {google && (
        <AsyncButton variant="ghost" className="w-full" onClick={signInGoogle}>
          <GoogleG />
          {t.login_google}
        </AsyncButton>
      )}
      {line && (
        <a
          href={lineHref}
          onClick={(ev) => { if (lineBusy) ev.preventDefault(); setLineBusy(true); }}
          aria-busy={lineBusy}
          className="pressable inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-[#06C755] px-5 text-[15px] font-bold text-white hover:brightness-95"
        >
          {lineBusy ? <Spinner /> : <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded bg-white text-[11px] font-black text-[#06C755]">L</span>}
          {t.login_line}
        </a>
      )}
      {emailOn && (google || line) && (
        <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />{t.login_or}<span className="h-px flex-1 bg-line" /></div>
      )}
      {emailOn && (
        <form className="space-y-3" onSubmit={(ev) => { ev.preventDefault(); }}>
          <h2 className="font-display text-lg font-bold">{mode === "signup" ? t.login_create_title : mode === "forgot" ? t.login_forgot_title : t.login_password_title}</h2>
          <label htmlFor="email" className="block text-sm font-semibold">{t.login_email}</label>
          <input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.login_email_ph} className={input} />
          {mode !== "forgot" && (
            <>
              <label htmlFor="password" className="block text-sm font-semibold">{t.login_password}</label>
              <input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
              {mode === "signup" && <p className="text-xs text-muted">{t.login_password_hint}</p>}
            </>
          )}
          {mode === "signup" && (
            <>
              <label htmlFor="password2" className="block text-sm font-semibold">{t.login_password_again}</label>
              <input id="password2" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={input} />
            </>
          )}
          <AsyncButton className="w-full" onClick={mode === "signup" ? signUp : mode === "forgot" ? forgot : signIn}>
            {mode === "signup" ? t.login_create : mode === "forgot" ? t.login_forgot_send : t.login_verify}
          </AsyncButton>
          <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold text-primary">
            {mode === "signin" && <><button type="button" className="min-h-11" onClick={() => switchTo("signup")}>{t.login_to_create}</button><button type="button" className="min-h-11" onClick={() => switchTo("forgot")}>{t.login_to_forgot}</button></>}
            {mode !== "signin" && <button type="button" className="min-h-11" onClick={() => switchTo("signin")}>{t.login_to_signin}</button>}
          </div>
        </form>
      )}
      <div aria-live="polite" className="min-h-5 text-sm">
        {error && <p className="font-semibold text-danger">✕ {error}</p>}
        {info && <p className="rounded-control bg-mint p-3 text-teal-deep">{info}</p>}
      </div>
    </div>
  );
}
