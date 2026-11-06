import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

// A malformed answer becomes zeros instead of breaking the page.
const Stats = z.object({
  users: z.number().catch(0), active_today: z.number().catch(0), active_7: z.number().catch(0), signups_7: z.number().catch(0),
  daily: z.array(z.object({ day: z.string(), active: z.number() })).catch([]),
});

export default async function AnalyticsPage() {
  await requireAdminPage();
  const { t } = await getT();
  const { data, error } = await (await createClient()).rpc("admin_analytics", { p_days: 30 });
  if (error) console.error("[analytics] rpc failed", error.message);
  const s = Stats.parse(data ?? {});
  const max = Math.max(1, ...s.daily.map((d) => d.active));
  const tiles = [[t.analytics_users, s.users], [t.analytics_active_today, s.active_today], [t.analytics_active_7, s.active_7], [t.analytics_signups_7, s.signups_7]] as const;
  return (
    <div className="space-y-4">
      <PageHead title={t.analytics_title} art="analytics" tone="gold" />
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(([label, n]) => (
          <div key={label} className="rounded-card border border-line bg-surface p-4 shadow-card">
            <p className="text-sm text-muted">{label}</p>
            <p className="font-display text-3xl font-extrabold tabular">{n.toLocaleString()}</p>
          </div>
        ))}
      </div>
      <section className="rounded-card border border-line bg-surface p-4 shadow-card">
        <h2 className="mb-3 font-display text-lg font-bold">{t.analytics_daily}</h2>
        <div className="flex h-32 items-end gap-1" role="img" aria-label={t.analytics_daily}>
          {s.daily.map((d) => (
            <div key={d.day} title={`${d.day}: ${d.active}`} className="flex-1 rounded-t bg-primary" style={{ height: `${Math.max(4, (d.active / max) * 100)}%` }} />
          ))}
        </div>
      </section>
    </div>
  );
}
