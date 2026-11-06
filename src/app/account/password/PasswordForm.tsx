"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/I18n";
import { AsyncButton } from "@/components/Buttons";
import { inputCls } from "@/components/apply/fields";

export function PasswordForm() {
  const t = useT();
  const [pw, setPw] = useState(""), [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setMsg(null);
    if (pw.length < 8) return setMsg({ ok: false, text: t.err_password_short });
    if (pw !== again) return setMsg({ ok: false, text: t.err_password_mismatch });
    const { error } = await createClient().auth.updateUser({ password: pw });
    if (error) { console.error("[password] update", error.message); return setMsg({ ok: false, text: t.login_failed }); }
    setPw(""); setAgain(""); setMsg({ ok: true, text: t.password_saved });
  };
  return (
    <form className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="pw1" className="block text-sm font-semibold">{t.password_new}</label>
      <input id="pw1" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
      <p className="text-xs text-muted">{t.login_password_hint}</p>
      <label htmlFor="pw2" className="block text-sm font-semibold">{t.login_password_again}</label>
      <input id="pw2" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={inputCls} />
      <AsyncButton className="w-full" onClick={save}>{t.save}</AsyncButton>
      <div aria-live="polite" className="min-h-5 text-sm">{msg && <p className={`font-semibold ${msg.ok ? "text-success" : "text-danger"}`}>{msg.ok ? "✓" : "✕"} {msg.text}</p>}</div>
    </form>
  );
}
