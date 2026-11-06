import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

/** Errors the server threw while showing pages or running actions (scrubbed of personal data). The reference matches the "ref" shown on the error page. */
export default async function ErrorsPage() {
  await requireAdminPage();
  const { t, lang } = await getT();
  const { data } = await (await createClient()).from("error_log").select("id, at, route, kind, message, digest").order("at", { ascending: false }).limit(100);
  const fmt = new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "medium" });
  return (
    <div className="space-y-4">
      <PageHead title={t.errors_title} hint={t.errors_hint} art="audit" tone="rose" />
      {(data ?? []).length === 0 ? <p className="rounded-card border border-line bg-surface p-5 text-muted">{t.errors_empty}</p> : (
        <ul className="space-y-2">{data!.map((r) => (
          <li key={r.id} className="rounded-card border border-line bg-surface p-4 text-sm shadow-card">
            <p className="flex flex-wrap items-center justify-between gap-2"><b className="font-mono text-xs">{r.route ?? "—"}</b><span className="text-xs text-muted tabular">{fmt.format(new Date(r.at))}{r.digest ? ` · ref ${r.digest}` : ""}</span></p>
            <p className="mt-1 break-words text-danger">{r.message}</p>
          </li>))}</ul>
      )}
    </div>
  );
}
