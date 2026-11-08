import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { PageHead } from "@/components/PageHead";
import { getSetting } from "@/lib/settings";
import { AUDIT_CATEGORIES, DEFAULT_AUDIT_CONFIG, parseAuditConfig } from "@/lib/audit-config";
import { saveAuditConfigAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireAdminPage("audit");
  const { t, lang } = await getT();
  const { data } = await (await createClient()).from("audit_log").select("id, at, actor_id, actor_role, action, entity, detail, source").order("at", { ascending: false }).limit(100);
  const fmtDate = new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "medium" });
  const rows = data ?? [];
  const cfg = parseAuditConfig(await getSetting<unknown>("audit_config", DEFAULT_AUDIT_CONFIG));
  const label = (id: string) => (t as unknown as Record<string, string>)[`audit_k_${id}`] ?? id;
  return (
    <div>
      <PageHead title={t.audit_title} art="audit" tone="sand" />
      <ActionForm action={saveAuditConfigAction} className="mb-5 space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.audit_settings}</h2>
        <label className="flex items-center gap-3 text-[15px] font-bold"><input type="checkbox" name="enabled" defaultChecked={cfg.enabled} className="size-5" />{t.audit_enabled}</label>
        <p className="text-sm text-muted">{t.audit_kinds_hint}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {AUDIT_CATEGORIES.map((c) => (
            <label key={c.id} className="flex items-start gap-3 rounded-control border border-line p-3">
              <input type="checkbox" name="kind" value={c.id} defaultChecked={!cfg.disabled.includes(c.id)} className="mt-0.5 size-5" />
              <span className="min-w-0"><b className="block text-[15px]">{label(c.id)}</b><span className="block break-words text-xs text-muted">{c.examples}</span></span>
            </label>
          ))}
        </div>
        <p className="rounded-control bg-sky p-3 text-sm text-primary">{t.audit_always}</p>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
      {!cfg.enabled && <p role="status" className="mb-3 rounded-card border border-danger bg-rose p-4 text-sm font-semibold text-danger">{t.audit_off_notice}</p>}
      {rows.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-5 text-muted">{t.audit_empty}</p>
      ) : (
        <div tabIndex={0} role="region" aria-label={t.audit_title} className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-start text-sm tabular">
            <thead className="bg-bg text-xs uppercase tracking-wide text-muted">
              <tr><th className="p-3">{t.audit_when}</th><th className="p-3">{t.audit_who}</th><th className="p-3">{t.audit_what}</th><th className="p-3">{t.audit_detail}</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap p-3">{fmtDate.format(new Date(r.at))}</td>
                  <td className="p-3"><span className="font-mono text-xs">{r.actor_id?.slice(0, 8) ?? "—"}</span> <span className="text-muted">{r.actor_role}</span></td>
                  <td className="p-3 font-semibold">{r.action}{r.source === "db" && <span className="ms-1 rounded bg-sky px-1 text-xs text-primary">db</span>}</td>
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
