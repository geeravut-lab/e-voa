import { requireUser } from "@/lib/auth";
import { requireFeaturePage } from "@/lib/flags";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadMaster, loadMasters } from "@/lib/master";
import { loadFees, requiredDocuments, documentKinds } from "@/lib/applications/service";
import { offersFor } from "@/lib/partners/service";
import { flightLookupConfigured } from "@/lib/flights";
import { decryptText } from "@/lib/crypto";
import { applicationFees } from "@/lib/pricing";
import { DEFAULT_REFUND_POLICY, parseRefundPolicy } from "@/lib/payments/refund-policy";
import { getSetting } from "@/lib/settings";
import { removeApplicationAction, saveAddonsAction, checkoutAction } from "@/app/actions/apply";
import { ActionForm } from "@/components/ActionForm";
import { AppLink } from "@/components/AppLink";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { Stepper } from "@/components/apply/Stepper";
import { TripForm } from "@/components/apply/TripForm";
import { TravelerForm, type TravelerValues } from "@/components/apply/TravelerForm";
import { DocSlot } from "@/components/apply/DocSlot";
import { docLabel } from "@/lib/reasons";
import { reasonText } from "@/lib/reasons";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f-]{36}$/i;
const opts = (rows: { id: number; label: string }[]) => rows.map((r) => ({ id: r.id, label: r.label }));
const thb = (n: number) => `THB ${n.toLocaleString("en-US")}`;

export default async function ApplyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireFeaturePage("apply");
  const v = await requireUser("/apply");
  const sp = await searchParams;
  const { t } = await getT();
  const db = await createClient();
  const tripId = sp.trip && UUID.test(sp.trip) ? sp.trip : null;
  const { data: trip } = tripId ? await db.from("trips").select("*").eq("id", tripId).eq("owner_id", v.user.id).maybeSingle() : { data: null };
  const step = !trip ? 1 : Math.min(Math.max(Number(sp.step) || 1, 1), 4);
  const fees = await loadFees();
  const head = <PageHead title={t.card_apply} hint={t.apply_hint} art="apply" tone="gold" />;

  // ------------------------------------------------------------------ step 1
  if (step === 1) {
    const m = await loadMasters(["arrivalAirport", "airlines", "purposeOfVisit", "nationality"]);
    return (
      <div>{head}<Stepper step={1} t={t} />
        <TripForm trip={trip ?? {}} airports={opts(m.arrivalAirport)} airlines={opts(m.airlines)} purposes={opts(m.purposeOfVisit)} countries={opts(m.nationality)} fees={fees} canLookup={flightLookupConfigured()} />
      </div>
    );
  }

  // applications of this trip that are still alive
  const { data: apps } = await db.from("applications").select("id, ref_no, status, package, form, traveler_id, visa_fee_thb, service_fee_thb").eq("trip_id", trip!.id).eq("owner_id", v.user.id).not("status", "in", "(cancelled,expired)").order("created_at");
  const draft = (apps ?? []).filter((a) => a.status === "draft" || a.status === "awaiting_payment");
  const travelerIds = [...new Set(draft.map((a) => a.traveler_id))];
  const { data: trs } = travelerIds.length ? await db.from("travelers").select("id, given_name, surname").in("id", travelerIds) : { data: [] };
  const nameOf = (id: string) => { const x = trs?.find((r) => r.id === id); return x ? `${x.given_name} ${x.surname}` : ""; };
  const required = await requiredDocuments();
  const kindsOf = new Map<string, string[]>(await Promise.all(draft.map(async (a) => [a.id, await documentKinds(a.id)] as const)));

  // ------------------------------------------------------------------ step 2
  if (step === 2) {
    const selected = sp.app === "new" ? "new" : sp.app && UUID.test(sp.app) ? sp.app : draft.length === 0 ? "new" : null;
    const done = draft.length > 0 && draft.every((a) => required.every((k) => k === "insurance" || (kindsOf.get(a.id) ?? []).includes(k)));
    const back = <AppLink href={`/apply?step=1&trip=${trip!.id}`} className={btnClass("ghost")}>{t.back}</AppLink>;
    let form: React.ReactNode = null;
    if (selected) {
      const m = await loadMasters(["salutation", "gender", "nationality", "occupation", "yearlyIncome", "placeOfStay", "city"]);
      let values: TravelerValues = {};
      const app = selected !== "new" ? draft.find((a) => a.id === selected) : undefined;
      const reuse = selected === "new" && sp.traveler && UUID.test(sp.traveler) ? sp.traveler : app?.traveler_id;
      if (reuse) {
        const { data: tr } = await db.from("travelers").select("*").eq("id", reuse).eq("owner_id", v.user.id).maybeSingle();
        if (tr) values = { travelerId: tr.id, given_name: tr.given_name, middle_name: tr.middle_name ?? "", surname: tr.surname, gender_id: tr.gender_id ?? undefined, salutation_id: tr.salutation_id ?? undefined, date_of_birth: tr.date_of_birth ?? undefined, nationality_id: tr.nationality_id ?? undefined,
          passport_no: tr.passport_no_enc ? decryptText(tr.passport_no_enc) : "", passport_issue_date: tr.passport_issue_date ?? undefined, passport_expiry_date: tr.passport_expiry_date ?? undefined, passport_place_of_issue: tr.passport_place_of_issue ?? "", email: tr.email ?? v.user.email ?? "", phone: tr.phone ?? "" };
      }
      const f = (app?.form ?? {}) as Record<string, unknown> & { stay?: Record<string, unknown> };
      if (app) values = { ...values, appId: app.id, isd_code: String(f.isd_code ?? ""), residency_id: f.residency_id as number, permanent_address: String(f.permanent_address ?? ""), state: String(f.state ?? ""), yearly_income_id: f.yearly_income_id as number, occupation_id: f.occupation_id as number, first_time_traveller: f.first_time_traveller as number,
        place_of_stay_id: f.stay?.place_of_stay_id as number, stay_name: String(f.stay?.name ?? ""), city_id: f.stay?.city_id as number, district_id: f.stay?.district_id as number, sub_district_id: f.stay?.sub_district_id as number, pin_code: String(f.stay?.pin_code ?? ""), street: String(f.stay?.street ?? ""), reference: String(f.stay?.reference ?? "") };
      else values = { email: v.user.email ?? "", ...values };
      const cityId = values.city_id, distId = values.district_id;
      const [districts, subs] = await Promise.all([cityId ? loadMaster("district", cityId) : [], distId ? loadMaster("subDistrict", distId) : []]);
      form = (
        <div className="space-y-4">
          <TravelerForm key={selected + (values.travelerId ?? "")} tripId={trip!.id} v={values}
            lists={{ salutations: opts(m.salutation), genders: opts(m.gender), nationalities: m.nationality.map((r) => ({ id: r.id, label: r.label, code: String((r.extra as { CountryCode?: string }).CountryCode ?? "") })), countries: opts(m.nationality), incomes: opts(m.yearlyIncome), occupations: opts(m.occupation), stays: opts(m.placeOfStay), cities: opts(m.city), districts: opts(districts), subDistricts: opts(subs) }} />
          {app && (
            <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
              <h2 className="font-display text-lg font-bold">{t.apply_docs_title}</h2>
              <p className="text-sm text-muted">{t.apply_docs_hint}</p>
              {[...required, "additional"].map((k) => <DocSlot key={k} appId={app.id} kind={k} have={(kindsOf.get(app.id) ?? []).includes(k)} required={required.includes(k)} />)}
              <ActionForm action={removeApplicationAction}><input type="hidden" name="appId" value={app.id} /><input type="hidden" name="tripId" value={trip!.id} /><SubmitButton variant="danger">{t.apply_remove_traveler}</SubmitButton></ActionForm>
            </section>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-4">{head}<Stepper step={2} t={t} />
        {draft.length > 0 && (
          <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="font-display text-lg font-bold">{t.apply_travelers}</h2>
            <ul className="divide-y divide-line">
              {draft.map((a) => {
                const missing = required.filter((k) => k !== "insurance" && !(kindsOf.get(a.id) ?? []).includes(k));
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div><p className="font-semibold">{nameOf(a.traveler_id)}</p><p className={`text-xs font-semibold ${missing.length ? "text-gold-deep" : "text-success"}`}>{missing.length ? `${t.apply_missing}: ${missing.map((k) => docLabel(t, k)).join(", ")}` : `✓ ${t.apply_complete}`}</p></div>
                    <AppLink href={`/apply?step=2&trip=${trip!.id}&app=${a.id}`} className={btnClass("ghost", "min-h-9 px-4")}>{t.edit}</AppLink>
                  </li>
                );
              })}
            </ul>
            {selected !== "new" && <AppLink href={`/apply?step=2&trip=${trip!.id}&app=new`} className={btnClass("ghost", "w-full")}>+ {t.apply_add_traveler}</AppLink>}
          </section>
        )}
        {form}
        <div className="flex gap-2">{back}{draft.length > 0 && <AppLink href={`/apply?step=3&trip=${trip!.id}`} className={btnClass(done ? "primary" : "ghost", "flex-1")}>{t.apply_next}</AppLink>}</div>
      </div>
    );
  }

  // ------------------------------------------------------------------ step 3
  if (step === 3) {
    const offers = await offersFor(trip!.package ?? "regular", trip!.arrival_airport_id);
    const { data: chosen } = draft.length ? await db.from("addon_orders").select("application_id, category, package_code").in("application_id", draft.map((a) => a.id)).eq("status", "pending_payment") : { data: [] };
    const cats = ["insurance", "esim", "sim", "vip", "health"] as const;
    const catName: Record<string, string> = { insurance: t.extras_insurance, esim: t.extras_esim, sim: t.extras_sim, vip: t.extras_vip, health: t.extras_health };
    return (
      <div className="space-y-4">{head}<Stepper step={3} t={t} />
        <p className="text-sm text-muted">{t.apply_extras_hint}</p>
        <ActionForm action={saveAddonsAction} className="space-y-4">
          <input type="hidden" name="tripId" value={trip!.id} />
          {draft.map((a) => (
            <section key={a.id} className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
              <h2 className="font-display text-lg font-bold">{nameOf(a.traveler_id)}</h2>
              {cats.map((c) => {
                const list = offers.filter((o) => o.category === c);
                if (list.length === 0) return null;
                const cur = chosen?.find((x) => x.application_id === a.id && x.category === c)?.package_code ?? "";
                return (
                  <fieldset key={c} className="space-y-2">
                    <legend className="text-sm font-bold">{catName[c]}</legend>
                    <label className="flex items-center gap-3 rounded-control border border-line p-3 text-sm"><input type="radio" name={`addon:${a.id}:${c}`} value="" defaultChecked={cur === ""} />{t.extras_none}</label>
                    {list.map((o) => (
                      <label key={o.package_code} className={`flex items-start gap-3 rounded-control border border-line p-3 ${o.offer.available ? "" : "opacity-60"}`}>
                        <input type="radio" name={`addon:${a.id}:${c}`} value={o.package_code} defaultChecked={cur === o.package_code} disabled={!o.offer.available} className="mt-1" />
                        <span className="min-w-0 flex-1"><b className="block text-sm">{o.name}</b>{o.detail && <span className="block text-xs text-muted">{o.detail}</span>}
                          {!o.offer.available && <span className="block text-xs font-semibold text-gold-deep">{o.offer.reason === "express" ? t.extras_not_with_express : t.extras_not_at_airport}</span>}</span>
                        <b className="tabular text-sm">{thb(o.price_thb)}</b>
                      </label>
                    ))}
                  </fieldset>
                );
              })}
            </section>
          ))}
          <div className="flex gap-2"><AppLink href={`/apply?step=2&trip=${trip!.id}`} className={btnClass("ghost")}>{t.back}</AppLink><SubmitButton className="flex-1">{t.apply_next}</SubmitButton></div>
        </ActionForm>
      </div>
    );
  }

  // ------------------------------------------------------------------ step 4
  const { data: addons } = draft.length ? await db.from("addon_orders").select("application_id, package_name, price_thb").in("application_id", draft.map((a) => a.id)).eq("status", "pending_payment") : { data: [] };
  let total = 0;
  const policy = parseRefundPolicy(await getSetting<unknown>("refund_policy", DEFAULT_REFUND_POLICY));
  const rows = draft.map((a) => {
    const fe = applicationFees(fees, a.package), mine = (addons ?? []).filter((x) => x.application_id === a.id);
    const sum = a.visa_fee_thb + a.service_fee_thb + mine.reduce((s, x) => s + Number(x.price_thb), 0); total += sum;
    return { a, mine, sum, fe };
  });
  const missingDocs = draft.some((a) => required.some((k) => k !== "insurance" && !(kindsOf.get(a.id) ?? []).includes(k)));
  return (
    <div className="space-y-4">{head}<Stepper step={4} t={t} />
      {rows.map(({ a, mine, sum }) => (
        <section key={a.id} className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">{nameOf(a.traveler_id)}</h2>
          <dl className="space-y-1 text-sm tabular">
            <div className="flex justify-between"><dt>{t.pay_visa_fee}</dt><dd>{thb(a.visa_fee_thb)}</dd></div>
            <div className="flex justify-between"><dt>{a.package === "express" ? t.pay_service_express : t.pay_service_regular}</dt><dd>{thb(a.service_fee_thb)}</dd></div>
            {mine.map((x, i) => <div key={i} className="flex justify-between"><dt>{x.package_name}</dt><dd>{thb(Number(x.price_thb))}</dd></div>)}
            <div className="flex justify-between border-t border-line pt-1 font-bold"><dt>{t.pay_subtotal}</dt><dd>{thb(sum)}</dd></div>
          </dl>
        </section>
      ))}
      <section className="rounded-card border-2 border-primary bg-sky p-5">
        <p className="flex justify-between font-display text-xl font-extrabold tabular"><span>{t.pay_total}</span><span>{thb(total)}</span></p>
      </section>
      <section className="space-y-1 rounded-card border border-line bg-surface p-5 text-sm shadow-card">
        <h2 className="font-display text-base font-bold">{t.fees_refund_title}</h2>
        <p>{policy.visa_fee_refundable ? t.refund_visa_yes : t.refund_visa_no}</p>
        <p>{policy.unused_addons_refundable ? t.refund_addons_yes : t.refund_addons_no}</p>
        <p className="text-muted">{t.pay_test_mode}</p>
      </section>
      {missingDocs && <p role="alert" className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{t.pay_docs_missing}</p>}
      <ActionForm action={checkoutAction}>
        <input type="hidden" name="tripId" value={trip!.id} />
        <div className="flex gap-2"><AppLink href={`/apply?step=3&trip=${trip!.id}`} className={btnClass("ghost")}>{t.back}</AppLink><SubmitButton variant="gold" className="flex-1" disabled={draft.length === 0}>{t.pay_now} · {thb(total)}</SubmitButton></div>
      </ActionForm>
    </div>
  );
}
