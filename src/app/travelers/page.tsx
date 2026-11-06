import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { deleteTravelerAction } from "@/app/actions/public";
import { ActionForm } from "@/components/ActionForm";
import { AppLink } from "@/components/AppLink";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";

export default async function TravelersPage() {
  const v = await requireUser("/travelers");
  const { t, lang } = await getT();
  const db = await createClient();
  const { data } = await db.from("travelers").select("id, given_name, surname, passport_last4, passport_expiry_date, date_of_birth").eq("owner_id", v.user.id).order("created_at");
  const used = new Set(((await db.from("applications").select("traveler_id").eq("owner_id", v.user.id)).data ?? []).map((a) => a.traveler_id));
  const fmt = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });
  const soon = Date.now() + 180 * 86_400_000;
  return (
    <div className="space-y-4">
      <PageHead title={t.card_travelers} hint={t.travelers_hint} art="travelers" tone="sand" />
      {(data ?? []).length === 0 ? <p className="rounded-card border border-line bg-surface p-5 text-center text-muted shadow-card">{t.travelers_empty}</p> : (
        <ul className="space-y-3">{data!.map((x) => (
          <li key={x.id} className="space-y-2 rounded-card border border-line bg-surface p-4 shadow-card">
            <p className="font-display text-lg font-bold">{x.given_name} {x.surname}</p>
            <p className="text-sm text-muted tabular">{t.pass_passport_end}: ••••{x.passport_last4}{x.passport_expiry_date ? ` · ${t.apply_passport_expiry}: ${fmt.format(new Date(x.passport_expiry_date))}` : ""}</p>
            {x.passport_expiry_date && Date.parse(x.passport_expiry_date) < soon && <p className="rounded-control bg-gold-soft p-2 text-sm font-semibold text-gold-deep">{t.travelers_expiry_warn}</p>}
            <div className="flex flex-wrap gap-2">
              <AppLink href={`/apply?traveler=${x.id}`} className={btnClass("primary", "min-h-10")}>{t.travelers_use}</AppLink>
              {!used.has(x.id) && <ActionForm action={deleteTravelerAction}><input type="hidden" name="travelerId" value={x.id} /><SubmitButton variant="ghost">{t.travelers_delete}</SubmitButton></ActionForm>}
            </div>
          </li>))}</ul>
      )}
    </div>
  );
}
