import { getT } from "@/lib/i18n/server";
import { resolveRange } from "@/lib/revenue/range";
import { loadReport, requireTourismPage } from "@/lib/tourism/service";
import { TourismReport } from "@/components/TourismReport";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

/** The read-only statistics page for government / TAT accounts (and staff). Counts only. */
export default async function GovPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requireTourismPage();
  const { t } = await getT();
  const sp = await searchParams;
  const range = resolveRange(sp.range, new Date(), sp.from, sp.to);
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_tourism_title} hint={t.gov_hint} art="analytics" tone="sky" />
      <TourismReport r={await loadReport(range, t)} t={t} base="/gov" range={range.key} />
    </div>
  );
}
