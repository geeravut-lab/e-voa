"use client";
import { useRef, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { RichText } from "@/components/RichText";
import { btnClass } from "@/components/buttonStyles";
import { useT } from "@/components/I18n";
import { errorText } from "@/lib/i18n/dict";
import { uploadNewsImageAction } from "@/app/actions/admin";

/**
 * A text box with a small toolbar for the rich news text (see lib/content/rich.ts): bold, italic, heading, list, quote, link, picture, and a preview.
 * The text stays in the parent's state (controlled), so nothing typed is lost when the server refuses a save.
 */
export function RichEditor({ name, value, onChange, rows, maxLength, label, required }: { name: string; value: string; onChange: (v: string) => void; rows: number; maxLength: number; label: string; required?: boolean }) {
  const t = useT(), ref = useRef<HTMLTextAreaElement>(null), file = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(false), [busy, setBusy] = useState(false), [msg, setMsg] = useState<string | null>(null);
  const edit = (fn: (sel: string) => { text: string; select?: [number, number] }) => {
    const el = ref.current; if (!el) return;
    const a = el.selectionStart, b = el.selectionEnd, r = fn(value.slice(a, b)), next = value.slice(0, a) + r.text + value.slice(b);
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => { el.focus(); const [s, e] = r.select ?? [a + r.text.length, a + r.text.length]; el.setSelectionRange(a + s, a + e); });
  };
  const wrap = (m: string, ph: string) => edit((sel) => ({ text: `${m}${sel || ph}${m}`, select: [m.length, m.length + (sel || ph).length] }));
  const linePrefix = (p: string, ph: string) => edit((sel) => ({ text: (sel || ph).split("\n").map((l) => `${p}${l}`).join("\n") }));
  const link = () => { const href = window.prompt(t.content_link_prompt, "https://"); if (!href) return; edit((sel) => ({ text: `[${sel || href}](${href.trim()})` })); };
  const upload = async (f: File) => {
    const alt = (window.prompt(t.content_image_alt, "") ?? "").replace(/[\[\]\n]/g, " ").trim(); setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await uploadNewsImageAction(fd);
      if (!r.ok) setMsg(errorText(r.error, t)); else edit(() => ({ text: `\n\n![${alt}](${r.url})\n\n` }));
    } catch { setMsg(errorText("err_generic", t)); } finally { setBusy(false); if (file.current) file.current.value = ""; }
  };
  const tb = btnClass("ghost", "min-h-10 px-3 text-sm");
  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-muted">{label}</span>
      <div role="toolbar" aria-label={t.content_toolbar} className="flex flex-wrap gap-1">
        <button type="button" onClick={() => wrap("**", t.content_tb_bold)} className={`${tb} font-bold`}>{t.content_tb_bold}</button>
        <button type="button" onClick={() => wrap("*", t.content_tb_italic)} className={`${tb} italic`}>{t.content_tb_italic}</button>
        <button type="button" onClick={() => linePrefix("## ", t.content_tb_heading)} className={tb}>{t.content_tb_heading}</button>
        <button type="button" onClick={() => linePrefix("- ", t.content_tb_list)} className={tb}>{t.content_tb_list}</button>
        <button type="button" onClick={() => linePrefix("> ", t.content_tb_quote)} className={tb}>{t.content_tb_quote}</button>
        <button type="button" onClick={link} className={tb}>{t.content_tb_link}</button>
        <button type="button" onClick={() => file.current?.click()} disabled={busy} aria-busy={busy} className={tb}>{busy && <Spinner />}{t.content_tb_image}</button>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label={t.content_tb_image} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        <button type="button" onClick={() => setPreview((p) => !p)} aria-pressed={preview} className={`${tb} ms-auto`}>{preview ? t.content_tb_edit : t.content_tb_preview}</button>
      </div>
      {preview
        ? <div className="min-h-32 rounded-control border-[1.5px] border-field bg-bg p-3"><RichText text={value} /></div>
        : <textarea ref={ref} name={name} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={maxLength} required={required} className="w-full rounded-control border-[1.5px] border-field bg-surface px-3 py-2 text-base" />}
      {preview && <input type="hidden" name={name} value={value} />}
      <div aria-live="polite" className="min-h-5 text-sm font-semibold text-danger">{msg}</div>
    </div>
  );
}
