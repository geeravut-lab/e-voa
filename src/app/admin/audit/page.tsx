import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireAdminPage();
  const { t, lang } = await getT();
  const { data } = await (await createClient()).from("audit_log").select("id, at, actor_id, actor_role, action, entity, detail, source").order("at", { ascending: false }).limit(100);
  const fmtDate = new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "medium" });
  const rows = data ?? [];
  return (
    <div>
      <PageHead title={t.audit_title} art="audit" tone="sand" />
      {rows.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-5 text-muted">{t.audit_empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm tabular">
            <thead className="bg-bg text-xs uppercase tracking-wide text-muted">
              <tr><th className="p-3">{t.audit_when}</th><th className="p-3">{t.audit_who}</th><th className="p-3">{t.audit_what}</th><th className="p-3">{t.audit_detail}</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap p-3">{fmtDate.format(new Date(r.at))}</td>
                  <td className="p-3"><span className="font-mono text-xs">{r.actor_id?.slice(0, 8) ?? "—"}</span> <span className="text-muted">{r.actor_role}</span></td>
                  <td className="p-3 font-semibold">{r.action}{r.source === "db" && <span className="ml-1 rounded bg-sky px-1 text-xs text-primary">db</span>}</td>
                  <td className="p-3 font-mono text-xs text-muted">{r.entity ?? ""} {JSON.stringify(r.detail ?? {}) === "{}" ? "" : JSON.stringify(r.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
