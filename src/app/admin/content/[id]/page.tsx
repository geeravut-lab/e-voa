import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteContentAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { ContentForm } from "@/components/ContentForm";
import { AppLink } from "@/components/AppLink";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { btnClass } from "@/components/buttonStyles";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function EditContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  await requireAdminPage("content");
  const { t } = await getT();
  const { id } = await params, sp = await searchParams;
  if (id !== "new" && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: row } = id === "new" ? { data: null } : await createAdminClient().from("content_items").select("*").eq("id", id).maybeSingle();
  if (id !== "new" && !row) notFound();
  const kind: "faq" | "news" | "article" = row ? row.kind : sp.kind === "news" ? "news" : sp.kind === "article" ? "article" : "faq";
  const txt = (m: unknown, k: string) => ((m && typeof m === "object" ? (m as Record<string, string>)[k] : "") ?? "");
  const faq = kind === "faq", article = kind === "article";
  return (
    <div className="space-y-4">
      <PageHead title={`${faq ? t.content_faq : article ? t.content_articles : t.content_news} · ${row ? t.content_edit : t.content_new}`} art="guide" tone="mint" />
      <AppLink href={`/admin/content?kind=${kind}`} className={btnClass("ghost", "min-h-10 px-4")}>{t.back}</AppLink>
      <ContentForm kind={kind} row={{ id: row?.id, slug: row?.slug, title: row?.title, summary: row?.summary, body: row?.body, published: row?.published, pinned: row?.pinned, sort: row?.sort, date: row?.published_at ? String(row.published_at).slice(0, 10) : "" }} />
      {row && article && <AppLink href={`/articles/${row.slug}`} className={btnClass("ghost", "min-h-10 px-4")}>{t.content_view}</AppLink>}
      {row && <ActionForm action={deleteContentAction.bind(null, row.id)} className="rounded-card border border-line bg-surface p-5 shadow-card"><SubmitButton variant="danger">{t.content_delete}</SubmitButton></ActionForm>}
    </div>
  );
}
