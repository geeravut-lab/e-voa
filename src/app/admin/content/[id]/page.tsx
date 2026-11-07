import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BODY_MAX, TITLE_MAX } from "@/lib/content/managed";
import { deleteContentAction, saveContentAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { AppLink } from "@/components/AppLink";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { btnClass } from "@/components/buttonStyles";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";
const LANGS = [["en", "English", "en"], ["th", "ไทย", "th"], ["zh", "简体中文", "zh-CN"]] as const;

export default async function EditContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  await requireAdminPage();
  const { t } = await getT();
  const { id } = await params, sp = await searchParams;
  if (id !== "new" && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: row } = id === "new" ? { data: null } : await createAdminClient().from("content_items").select("*").eq("id", id).maybeSingle();
  if (id !== "new" && !row) notFound();
  const kind: "faq" | "news" = row ? row.kind : sp.kind === "news" ? "news" : "faq";
  const txt = (m: unknown, k: string) => ((m && typeof m === "object" ? (m as Record<string, string>)[k] : "") ?? "");
  const faq = kind === "faq";
  return (
    <div className="space-y-4">
      <PageHead title={`${faq ? t.content_faq : t.content_news} · ${row ? t.content_edit : t.content_new}`} art="guide" tone="mint" />
      <AppLink href={`/admin/content?kind=${kind}`} className={btnClass("ghost", "min-h-10 px-4")}>{t.back}</AppLink>
      <ActionForm action={saveContentAction} className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <input type="hidden" name="kind" value={kind} />{row && <input type="hidden" name="id" value={row.id} />}
        {LANGS.map(([short, name, key], i) => (
          <fieldset key={short} className="space-y-2 rounded-control border border-line p-3">
            <legend className="px-1 text-sm font-bold">{name}{i === 0 ? ` · ${t.content_required}` : ""}</legend>
            <label className="block space-y-1"><span className="text-xs font-semibold text-muted">{faq ? t.content_question : t.content_headline}</span><input name={`title_${short}`} defaultValue={txt(row?.title, key)} maxLength={TITLE_MAX} required={i === 0} className={inputCls} /></label>
            <label className="block space-y-1"><span className="text-xs font-semibold text-muted">{faq ? t.content_answer : t.content_text}</span><textarea name={`body_${short}`} defaultValue={txt(row?.body, key)} rows={faq ? 5 : 7} maxLength={BODY_MAX} required={i === 0} className={`${inputCls} text-sm`} /></label>
          </fieldset>
        ))}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="published" defaultChecked={row?.published ?? false} className="mt-1 h-5 w-5" /><span>{t.content_publish}</span></label>
          {!faq && <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="pinned" defaultChecked={row?.pinned ?? false} className="mt-1 h-5 w-5" /><span>{t.content_pin}</span></label>}
          {faq && <label className="block space-y-1"><span className="text-sm font-semibold">{t.content_order}</span><input name="sort" type="number" min={0} max={9999} defaultValue={row?.sort ?? 100} className={inputCls} /></label>}
        </div>
        <p className="text-xs text-muted">{t.content_note}</p>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
      {row && <ActionForm action={deleteContentAction.bind(null, row.id)} className="rounded-card border border-line bg-surface p-5 shadow-card"><SubmitButton variant="danger">{t.content_delete}</SubmitButton></ActionForm>}
    </div>
  );
}
