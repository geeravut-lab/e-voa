"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/I18n";
import { AsyncButton } from "@/components/Buttons";
import { AppLink } from "@/components/AppLink";
import { errorText } from "@/lib/i18n/dict";
import { inputCls } from "@/components/inputStyles";
import { btnClass } from "@/components/buttonStyles";

type Msg = { role: "user" | "assistant"; content: string };

/** The help assistant. The conversation lives in this page only (nothing is saved); the last 10 turns are sent with each question. */
export function ChatBox({ suggestions }: { suggestions: string[] }) {
  const t = useT();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs.length, err]);

  const send = async (q: string) => {
    const question = q.trim(); if (!question) return;
    setErr(null); setText("");
    const next: Msg[] = [...msgs, { role: "user", content: question.slice(0, 2000) }];
    setMsgs(next);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(-10) }) });
      const j = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok || j.reply === undefined) return setErr(errorText(j.error ?? "err_ai_failed", t));
      setMsgs([...next, { role: "assistant", content: j.reply || t.ai_declined }]);
    } catch { setErr(t.err_ai_failed); }
  };

  return (
    <div className="space-y-3">
      <div className="min-h-48 space-y-3 rounded-card border border-line bg-surface p-4 shadow-card" aria-live="polite">
        {msgs.length === 0 && (
          <div className="space-y-2"><p className="text-sm text-muted">{t.ai_intro}</p>
            <div className="flex flex-wrap gap-2">{suggestions.map((s) => <AsyncButton key={s} variant="ghost" className="min-h-9 px-3 text-sm" onClick={() => send(s)}>{s}</AsyncButton>)}</div></div>
        )}
        {msgs.map((m, i) => <p key={i} className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.role === "user" ? "ml-auto bg-primary text-white" : "bg-sky text-ink"}`}>{m.content}</p>)}
        {err && <p role="alert" className="rounded-control bg-rose p-3 text-sm font-semibold text-danger">✕ {err}</p>}
        <div ref={end} />
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={t.ai_placeholder} aria-label={t.ai_placeholder} className={`${inputCls} flex-1`} />
        <AsyncButton disabled={!text.trim()} onClick={() => send(text)}>{t.ai_send}</AsyncButton>
      </form>
      <p className="text-xs text-muted">{t.ai_note}</p>
      <AppLink href="/official" className={btnClass("ghost", "w-full")}>{t.official_title}</AppLink>
    </div>
  );
}
