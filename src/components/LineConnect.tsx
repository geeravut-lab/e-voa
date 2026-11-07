"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, MessageCircle, UserPlus } from "lucide-react";
import { AsyncButton } from "./Buttons";
import { OutLink } from "./OutLink";
import { errorText } from "@/lib/i18n/dict";
import { useT } from "./I18n";
import { startLineGuideAction } from "@/app/actions/messaging";

const CODE_MINUTES = 30;
/** The official LINE links: add-friend page, and a chat with the account that has the code already typed (the traveler only taps Send). */
export const lineAddUrl = (basicId: string) => `https://line.me/R/ti/p/${encodeURIComponent(basicId)}`;
export const lineSendUrl = (basicId: string, code: string) => `https://line.me/R/oaMessage/${encodeURIComponent(basicId)}/?${encodeURIComponent(code)}`;

/** Connect LINE as numbered steps: copy the code, add the friend, send the code. The page checks by itself until LINE has confirmed. */
export function LineConnect({ pending }: { pending: boolean }) {
  const t = useT(), router = useRouter();
  const [g, setG] = useState<{ code: string; basicId: string; at: number } | null>(null);
  const [err, setErr] = useState<string | null>(null), [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // while a code is on screen, ask the server every few seconds whether LINE has confirmed it (the page then shows "Connected")
  useEffect(() => {
    if (!g) return;
    const id = setInterval(() => { if (Date.now() - g.at > CODE_MINUTES * 60_000) clearInterval(id); else router.refresh(); }, 4000);
    return () => clearInterval(id);
  }, [g, router]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    if (!g) return;
    try { await navigator.clipboard.writeText(g.code); }
    catch { const el = document.createElement("textarea"); el.value = g.code; document.body.appendChild(el); el.select(); document.execCommand("copy"); el.remove(); }
    setCopied(true); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 2500);
  };
  const start = async () => { setErr(null); const r = await startLineGuideAction(); if (r.ok) { setG({ code: r.code, basicId: r.basicId, at: Date.now() }); setCopied(false); } else setErr(errorText(r.error, t)); };

  const step = "flex gap-3 rounded-control border border-line bg-bg p-3";
  const num = "grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-white";
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t.chat_line_how}</p>
      <AsyncButton onClick={start}>{g || pending ? t.chat_new_code : t.chat_connect}</AsyncButton>
      {err && <p role="alert" className="text-sm font-semibold text-danger">✕ {err}</p>}
      {g && (
        <ol className="space-y-3" aria-label={t.chat_line_steps}>
          <li className={step}>
            <span className={num} aria-hidden="true">1</span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold">{t.chat_line_s1}</p>
              <p className="text-xs text-muted">{t.chat_line_s1_hint.replace("{min}", String(CODE_MINUTES))}</p>
              <p className="select-all rounded-control bg-surface px-3 py-2 text-center font-mono text-2xl font-extrabold tracking-[0.3em]" aria-label={t.chat_code_label}>{g.code}</p>
              <AsyncButton variant="gold" onClick={copy}><Copy size={18} aria-hidden="true" />{copied ? `✓ ${t.chat_copied}` : t.chat_copy}</AsyncButton>
            </div>
          </li>
          <li className={step}>
            <span className={num} aria-hidden="true">2</span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold">{t.chat_line_s2}</p>
              <p className="text-xs text-muted">{t.chat_line_s2_hint.replace("{id}", g.basicId)}</p>
              <OutLink href={lineAddUrl(g.basicId)} icon={<UserPlus size={18} aria-hidden="true" />}>{t.chat_line_add}</OutLink>
            </div>
          </li>
          <li className={step}>
            <span className={num} aria-hidden="true">3</span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold">{t.chat_line_s3}</p>
              <p className="text-xs text-muted">{t.chat_line_s3_hint}</p>
              <OutLink href={lineSendUrl(g.basicId, g.code)} icon={<MessageCircle size={18} aria-hidden="true" />}>{t.chat_line_send}</OutLink>
            </div>
          </li>
          <li className={step}>
            <span className={num} aria-hidden="true">4</span>
            <div className="min-w-0 flex-1"><p className="font-semibold">{t.chat_line_s4}</p><p className="text-xs text-muted">{t.chat_line_s4_hint}</p></div>
          </li>
        </ol>
      )}
    </div>
  );
}
