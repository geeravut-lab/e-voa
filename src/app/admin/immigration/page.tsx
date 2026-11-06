import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRole, SITE_URL } from "@/lib/env";
import { gatewayFromEnv, immigrationHost } from "@/lib/immigration/gateway";
import { MASTER_FLAT } from "@/lib/immigration/schema";
import { syncListsAction, syncDistrictsAction, testImmigrationAction } from "@/app/actions/immigration";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

export default async function ImmigrationPage() {
  await requireAdminPage();
  const { t, lang } = await getT();
  const configured = !!gatewayFromEnv();
  const { data: sync } = await (await createClient()).from("master_sync").select("name, last_synced_at, row_count, last_error");
  const byName = new Map((sync ?? []).map((s) => [s.name, s]));
  let queue: Record<string, number> = {};
  if (hasServiceRole()) {
    const { data } = await createAdminClient().from("immigration_outbox").select("status");
    for (const r of data ?? []) queue[r.status] = (queue[r.status] ?? 0) + 1;
  }
  const sampleRow = hasServiceRole() ? await createAdminClient().from("master_data").select("id").eq("extra->>sample", "true").limit(1) : null;
  const isSample = (sampleRow?.data?.length ?? 0) > 0;
  const fmtDate = new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" });
  const names = [...MASTER_FLAT, "district", "subDistrict"] as string[];
  return (
    <div className="space-y-4">
      <PageHead title={t.imm_title} art="ops" tone="sky" />
      {isSample && <p role="alert" className="rounded-card border border-gold bg-gold-soft p-4 text-sm font-semibold text-gold-deep">⚠ {t.imm_sample_warning}</p>}
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        {configured ? (
          <>
            <p className="text-sm text-muted">{t.imm_endpoint}: <span className="font-mono font-semibold text-ink">{immigrationHost()}</span></p>
            <ActionForm action={testImmigrationAction}><SubmitButton variant="ghost">{t.imm_test}</SubmitButton></ActionForm>
          </>
        ) : (
          <p role="alert" className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">⚠ {t.imm_not_configured}</p>
        )}
        <div>
          <p className="text-sm font-semibold">{t.imm_callback}</p>
          <p className="break-all font-mono text-sm">{SITE_URL}/api/immigration/callback</p>
          <p className="text-xs text-muted">{t.imm_callback_hint}</p>
        </div>
      </section>

      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.imm_lists}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <ActionForm action={syncListsAction}><SubmitButton disabled={!configured}>{t.imm_sync_lists}</SubmitButton></ActionForm>
          <ActionForm action={syncDistrictsAction}><SubmitButton variant="ghost" disabled={!configured}>{t.imm_sync_districts}</SubmitButton></ActionForm>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm tabular">
            <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-2">{t.imm_list_name}</th><th>{t.imm_list_rows}</th><th>{t.imm_list_synced}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {names.map((n) => {
                const s = byName.get(n);
                return (
                  <tr key={n}>
                    <td className="py-2 font-semibold">{n}</td>
                    <td>{s?.row_count ?? 0}</td>
                    <td className={s?.last_error ? "text-danger" : "text-muted"}>{s?.last_error ? `✕ ${s.last_error}` : s?.last_synced_at ? fmtDate.format(new Date(s.last_synced_at)) : t.imm_never}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        {([["imm_queue_pending", (queue.pending ?? 0) + (queue.sending ?? 0)], ["imm_queue_sent", queue.sent ?? 0], ["imm_queue_failed", queue.failed ?? 0]] as const).map(([k, n]) => (
          <div key={k} className="rounded-card border border-line bg-surface p-4 shadow-card"><p className="text-xs text-muted">{t.imm_queue}: {t[k]}</p><p className="font-display text-2xl font-extrabold tabular">{n}</p></div>
        ))}
      </section>
    </div>
  );
}
