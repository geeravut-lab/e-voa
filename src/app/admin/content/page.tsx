import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickText } from "@/lib/content/managed";
import { seedFaqAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { AppLink } from "@/components/AppLink";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";

export default async function AdminContent({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireAdminPage();
  const { t, lang } = await getT();
  const kind = (await searchParams).kind === "news" ? "news" : "faq";
  const { data: rows } = await createAdminClient().from("content_items").select("id, title, published, pinned, sort, published_at, updated_at").eq("kind", kind).order(kind === "faq" ? "sort" : "published_at", { ascending: kind === "faq", nullsFirst: kind === "news" }).limit(500);
  const day = new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeZone: "Asia/Bangkok" });
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_content_title} hint={t.admin_content_hint} art="guide" tone="mint" />
      <div className="flex flex-wrap items-center gap-2">
        {(["faq", "news"] as const).map((k) => <AppLink key={k} href={`/admin/content?kind=${k}`} aria-current={kind === k ? "true" : undefined} className={btnClass(kind === k ? "primary" : "ghost", "min-h-10 px-4")}>{k === "faq" ? t.content_faq : t.content_news}</AppLink>)}
        <AppLink href={`/admin/content/new?kind=${kind}`} className={btnClass("gold", "min-h-10 px-4 ms-auto")}>{t.content_new}</AppLink>
      </div>
      {kind === "faq" && (rows ?? []).length === 0 && (
        <ActionForm action={seedFaqAction} className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
          <p className="text-sm">{t.content_seed_hint}</p><SubmitButton variant="ghost">{t.content_seed}</SubmitButton>
        </ActionForm>
      )}
      {(rows ?? []).length === 0 ? <p className="rounded-card border border-line bg-surface p-5 text-center text-muted shadow-card">{t.content_none}</p> : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
          {rows!.map((r) => (
            <li key={r.id}>
              <AppLink href={`/admin/content/${r.id}`} className="flex items-center gap-3 p-4">
                <span className="min-w-0 flex-1"><b className="block truncate">{pickText(r.title, "en")}</b>
                  <span className="block text-xs text-muted tabular">{kind === "faq" ? `#${r.sort}` : r.published_at ? day.format(new Date(r.published_at)) : "–"} · {t.content_updated} {day.format(new Date(r.updated_at))}</span></span>
                {r.pinned && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold-deep">{t.content_pinned}</span>}
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.published ? "bg-mint text-teal-deep" : "bg-line text-muted"}`}>{r.published ? t.content_published : t.content_draft}</span>
              </AppLink>
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-xs text-muted">{t.content_note}</p>
    </div>
  );
}
