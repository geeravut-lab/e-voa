"use client";
import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { inputCls } from "@/components/inputStyles";
import { saveContentAction } from "@/app/actions/admin";
import { ARTICLE_MAX, BODY_MAX, SUMMARY_MAX, TITLE_MAX } from "@/lib/content/managed";

type Texts = { en?: string; th?: string; "zh-CN"?: string };
export type ContentRow = { id?: string; slug?: string | null; title?: Texts; summary?: Texts; body?: Texts; published?: boolean; pinned?: boolean; sort?: number; date?: string };
const LANGS = [["en", "English"], ["th", "ไทย"], ["zh-CN", "简体中文"]] as const;
type Lg = (typeof LANGS)[number][0];

/**
 * The editor for one FAQ question, news item or travel article. Every field is CONTROLLED (kept in state), so when the server says "that address is taken" the text that was
 * typed is still there: a form that is not controlled is cleared after every submit, which would lose a long article.
 */
export function ContentForm({ kind, row }: { kind: "faq" | "news" | "article"; row: ContentRow }) {
  const t = useT(), faq = kind === "faq", article = kind === "article";
  const [v, setV] = useState({ slug: "", date: row.date ?? "", published: row.published ?? false, pinned: row.pinned ?? false, sort: String(row.sort ?? 100) });
  const [tx, setTx] = useState<Record<"title" | "summary" | "body", Record<Lg, string>>>({
    title: { en: row.title?.en ?? "", th: row.title?.th ?? "", "zh-CN": row.title?.["zh-CN"] ?? "" }, summary: { en: row.summary?.en ?? "", th: row.summary?.th ?? "", "zh-CN": row.summary?.["zh-CN"] ?? "" }, body: { en: row.body?.en ?? "", th: row.body?.th ?? "", "zh-CN": row.body?.["zh-CN"] ?? "" } });
  const set = (f: "title" | "summary" | "body", l: Lg, val: string) => setTx((o) => ({ ...o, [f]: { ...o[f], [l]: val } }));
  return (
    <ActionForm action={saveContentAction} className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <input type="hidden" name="kind" value={kind} />{row.id && <input type="hidden" name="id" value={row.id} />}
      {article && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1"><span className="text-sm font-semibold">{t.content_slug}</span>
            {row.id ? <p className="break-all rounded-control bg-bg px-3 py-2 font-mono text-sm">/articles/{row.slug}</p>
              : <input name="slug" value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} required maxLength={80} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="best-time-to-visit-chiang-mai" className={`${inputCls} font-mono`} />}
            <span className="block text-xs text-muted">{t.content_slug_hint}</span></label>
          <label className="block space-y-1"><span className="text-sm font-semibold">{t.content_date}</span><input name="date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className={inputCls} /></label>
        </div>
      )}
      {LANGS.map(([l, name], i) => {
        const short = l === "zh-CN" ? "zh" : l;
        return (
          <fieldset key={l} className="space-y-2 rounded-control border border-line p-3">
            <legend className="px-1 text-sm font-bold">{name}{i === 0 ? ` · ${t.content_required}` : ""}</legend>
            <label className="block space-y-1"><span className="text-xs font-semibold text-muted">{faq ? t.content_question : t.content_headline}</span><input name={`title_${short}`} value={tx.title[l]} onChange={(e) => set("title", l, e.target.value)} maxLength={TITLE_MAX} required={i === 0} className={inputCls} /></label>
            {article && <label className="block space-y-1"><span className="text-xs font-semibold text-muted">{t.content_summary}</span><textarea name={`summary_${short}`} value={tx.summary[l]} onChange={(e) => set("summary", l, e.target.value)} rows={2} maxLength={SUMMARY_MAX} required={i === 0} className={`${inputCls} text-sm`} /></label>}
            <label className="block space-y-1"><span className="text-xs font-semibold text-muted">{faq ? t.content_answer : t.content_text}</span><textarea name={`body_${short}`} value={tx.body[l]} onChange={(e) => set("body", l, e.target.value)} rows={faq ? 5 : article ? 16 : 7} maxLength={article ? ARTICLE_MAX : BODY_MAX} required={i === 0} className={`${inputCls} text-sm ${article ? "font-mono" : ""}`} /></label>
            {article && <p className="text-xs text-muted">{t.content_body_help}</p>}
          </fieldset>
        );
      })}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="published" checked={v.published} onChange={(e) => setV({ ...v, published: e.target.checked })} className="mt-1 h-5 w-5" /><span>{t.content_publish}</span></label>
        {kind === "news" && <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="pinned" checked={v.pinned} onChange={(e) => setV({ ...v, pinned: e.target.checked })} className="mt-1 h-5 w-5" /><span>{t.content_pin}</span></label>}
        {(faq || article) && <label className="block space-y-1"><span className="text-sm font-semibold">{t.content_order}</span><input name="sort" type="number" min={0} max={9999} value={v.sort} onChange={(e) => setV({ ...v, sort: e.target.value })} className={inputCls} /></label>}
      </div>
      <p className="text-xs text-muted">{t.content_note}</p>
      <SubmitButton>{t.save}</SubmitButton>
    </ActionForm>
  );
}
