import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { NavRowLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function PassList() {
  const v = await requireUser("/pass");
  const { t } = await getT();
  const db = await createClient();
  const { data: apps } = await db.from("applications").select("id, ref_no, status, traveler_id").eq("owner_id", v.user.id).in("status", ["approved", "used"]).order("decided_at", { ascending: false });
  const ids = [...new Set((apps ?? []).map((a) => a.traveler_id))];
  const { data: trs } = ids.length ? await db.from("travelers").select("id, given_name, surname").in("id", ids) : { data: [] };
  return (
    <div className="space-y-4">
      <PageHead title={t.card_pass} hint={t.pass_hint} art="pass" tone="sky" />
      {(apps ?? []).length === 0 ? <p className="rounded-card border border-line bg-surface p-5 text-center text-muted shadow-card">{t.pass_empty}</p> : (
        <ul className="space-y-3">{apps!.map((a) => { const tr = trs?.find((x) => x.id === a.traveler_id); return (
          <li key={a.id}><NavRowLink href={`/pass/${a.id}`} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card"><span className="min-w-0 flex-1"><b className="block truncate">{tr ? `${tr.given_name} ${tr.surname}` : a.ref_no}</b><span className="text-sm text-muted tabular">{a.ref_no}</span></span><StatusBadge status={a.status} t={t} /></NavRowLink></li>); })}</ul>
      )}
    </div>
  );
}
