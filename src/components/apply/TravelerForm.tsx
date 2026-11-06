"use client";
import { useState, useTransition } from "react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { Spinner } from "@/components/Spinner";
import { useT } from "@/components/I18n";
import { readMrzAction, } from "@/app/actions/apply";
import { loadChildrenAction } from "@/app/actions/lookup";
import { saveTravelerAction } from "@/app/actions/apply";
import { Field, Select, inputCls, type Opt } from "./fields";

export type TravelerValues = {
  travelerId?: string; appId?: string; given_name?: string; middle_name?: string; surname?: string; gender_id?: number; salutation_id?: number; date_of_birth?: string; nationality_id?: number;
  passport_no?: string; passport_issue_date?: string; passport_expiry_date?: string; passport_place_of_issue?: string; email?: string; phone?: string; isd_code?: string;
  residency_id?: number; permanent_address?: string; state?: string; yearly_income_id?: number; occupation_id?: number;
  place_of_stay_id?: number; stay_name?: string; city_id?: number; district_id?: number; sub_district_id?: number; pin_code?: string; street?: string; reference?: string; first_time_traveller?: number;
};
type Lists = { salutations: Opt[]; genders: Opt[]; nationalities: (Opt & { code?: string })[]; countries: Opt[]; incomes: Opt[]; occupations: Opt[]; stays: Opt[]; cities: Opt[]; districts: Opt[]; subDistricts: Opt[] };

/** Step 2: one traveler. The two lines at the bottom of the passport photo page can be pasted to fill the form; every check digit is verified first. */
export function TravelerForm({ tripId, v, lists, canRemove }: { tripId: string; v: TravelerValues; lists: Lists; canRemove?: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [mrz, setMrz] = useState(""), [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [f, setF] = useState<TravelerValues>(v);
  const set = (p: Partial<TravelerValues>) => setF((x) => ({ ...x, ...p }));
  const [districts, setDistricts] = useState<Opt[]>(lists.districts), [subs, setSubs] = useState<Opt[]>(lists.subDistricts);
  const [busyGeo, startGeo] = useTransition();

  const read = () => start(async () => {
    setNote(null);
    const r = await readMrzAction(mrz);
    if (!r) return setNote({ ok: false, text: t.apply_mrz_unreadable });
    const nat = lists.nationalities.find((n) => n.code === r.nationality);
    const male = r.sex === "M";
    const gender = lists.genders.find((g) => (male ? /^m/i : /^f/i).test(g.label));
    set({ surname: r.surname, given_name: r.givenNames.split(" ")[0] ?? "", middle_name: r.givenNames.split(" ").slice(1).join(" "), passport_no: r.passportNumber, date_of_birth: r.dateOfBirth, passport_expiry_date: r.expiryDate,
      ...(nat ? { nationality_id: nat.id } : {}), ...(gender ? { gender_id: gender.id } : {}) });
    setNote(r.valid ? { ok: true, text: t.apply_mrz_ok } : { ok: false, text: t.apply_mrz_check_failed });
  });

  const city = (id: number | null) => startGeo(async () => {
    set({ city_id: id ?? undefined, district_id: undefined, sub_district_id: undefined }); setDistricts([]); setSubs([]);
    if (id) setDistricts(await loadChildrenAction("district", id));
  });
  const district = (id: number | null) => startGeo(async () => {
    set({ district_id: id ?? undefined, sub_district_id: undefined }); setSubs([]);
    if (id) setSubs(await loadChildrenAction("subDistrict", id));
  });

  return (
    <ActionForm action={saveTravelerAction} className="space-y-5">
      <input type="hidden" name="tripId" value={tripId} />
      {f.travelerId && <input type="hidden" name="travelerId" value={f.travelerId} />}
      {v.appId && <input type="hidden" name="appId" value={v.appId} />}

      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.apply_mrz_title}</h2>
        <p className="text-sm text-muted">{t.apply_mrz_hint}</p>
        <textarea value={mrz} onChange={(e) => setMrz(e.target.value)} rows={2} spellCheck={false} placeholder={"P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10"} className={`${inputCls} font-mono text-xs`} aria-label={t.apply_mrz_title} />
        <button type="button" onClick={read} disabled={pending || mrz.trim().length < 20} aria-busy={pending} className="inline-flex min-h-11 items-center gap-2 rounded-control border-[1.5px] border-sky-line bg-surface px-4 text-sm font-bold text-primary disabled:opacity-60">{pending && <Spinner size={14} />}{t.apply_mrz_read}</button>
        {note && <p role="status" className={`rounded-control p-3 text-sm font-semibold ${note.ok ? "bg-mint text-teal-deep" : "bg-gold-soft text-gold-deep"}`}>{note.text}</p>}
      </section>

      <section className="grid gap-4 rounded-card border border-line bg-surface p-5 shadow-card sm:grid-cols-2">
        <h2 className="font-display text-lg font-bold sm:col-span-2">{t.apply_traveler_passport}</h2>
        <Field label={t.apply_salutation}>{(id) => <Select id={id} name="salutation_id" options={lists.salutations} value={f.salutation_id ?? ""} onChange={(x) => set({ salutation_id: x ?? undefined })} placeholder={t.choose} />}</Field>
        <Field label={t.apply_gender}>{(id) => <Select id={id} name="gender_id" options={lists.genders} value={f.gender_id ?? ""} onChange={(x) => set({ gender_id: x ?? undefined })} placeholder={t.choose} />}</Field>
        <Field label={t.apply_given_name}>{(id) => <input id={id} name="given_name" required value={f.given_name ?? ""} onChange={(e) => set({ given_name: e.target.value })} className={inputCls} />}</Field>
        <Field label={t.apply_middle_name}>{(id) => <input id={id} name="middle_name" value={f.middle_name ?? ""} onChange={(e) => set({ middle_name: e.target.value })} className={inputCls} />}</Field>
        <Field label={t.apply_surname}>{(id) => <input id={id} name="surname" required value={f.surname ?? ""} onChange={(e) => set({ surname: e.target.value })} className={inputCls} />}</Field>
        <Field label={t.apply_dob}>{(id) => <input id={id} name="date_of_birth" type="date" required value={f.date_of_birth ?? ""} onChange={(e) => set({ date_of_birth: e.target.value })} className={inputCls} />}</Field>
        <Field label={t.apply_nationality}>{(id) => <Select id={id} name="nationality_id" options={lists.nationalities} value={f.nationality_id ?? ""} onChange={(x) => set({ nationality_id: x ?? undefined })} placeholder={t.choose} />}</Field>
        <Field label={t.apply_passport_no}>{(id) => <input id={id} name="passport_no" required value={f.passport_no ?? ""} onChange={(e) => set({ passport_no: e.target.value.toUpperCase() })} autoCapitalize="characters" className={`${inputCls} font-mono`} />}</Field>
        <Field label={t.apply_passport_issue}>{(id) => <input id={id} name="passport_issue_date" type="date" required value={f.passport_issue_date ?? ""} onChange={(e) => set({ passport_issue_date: e.target.value })} className={inputCls} />}</Field>
        <Field label={t.apply_passport_expiry}>{(id) => <input id={id} name="passport_expiry_date" type="date" required value={f.passport_expiry_date ?? ""} onChange={(e) => set({ passport_expiry_date: e.target.value })} className={inputCls} />}</Field>
        <Field label={t.apply_passport_place} wide>{(id) => <input id={id} name="passport_place_of_issue" required value={f.passport_place_of_issue ?? ""} onChange={(e) => set({ passport_place_of_issue: e.target.value })} className={inputCls} />}</Field>
      </section>

      <section className="grid gap-4 rounded-card border border-line bg-surface p-5 shadow-card sm:grid-cols-2">
        <h2 className="font-display text-lg font-bold sm:col-span-2">{t.apply_traveler_contact}</h2>
        <Field label={t.apply_email}>{(id) => <input id={id} name="email" type="email" required value={f.email ?? ""} onChange={(e) => set({ email: e.target.value })} className={inputCls} />}</Field>
        <div className="grid grid-cols-[6rem_1fr] gap-2">
          <Field label={t.apply_isd}>{(id) => <input id={id} name="isd_code" required inputMode="numeric" value={f.isd_code ?? ""} onChange={(e) => set({ isd_code: e.target.value })} placeholder="66" className={inputCls} />}</Field>
          <Field label={t.apply_phone}>{(id) => <input id={id} name="phone" required inputMode="tel" value={f.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} className={inputCls} />}</Field>
        </div>
        <Field label={t.apply_residency}>{(id) => <Select id={id} name="residency_id" options={lists.countries} value={f.residency_id ?? ""} onChange={(x) => set({ residency_id: x ?? undefined })} placeholder={t.choose} />}</Field>
        <Field label={t.apply_state}>{(id) => <input id={id} name="state" required value={f.state ?? ""} onChange={(e) => set({ state: e.target.value })} className={inputCls} />}</Field>
        <Field label={t.apply_address} wide>{(id) => <input id={id} name="permanent_address" required maxLength={100} value={f.permanent_address ?? ""} onChange={(e) => set({ permanent_address: e.target.value })} className={inputCls} />}</Field>
        <Field label={t.apply_occupation}>{(id) => <Select id={id} name="occupation_id" options={lists.occupations} value={f.occupation_id ?? ""} onChange={(x) => set({ occupation_id: x ?? undefined })} placeholder={t.choose} />}</Field>
        <Field label={t.apply_income}>{(id) => <Select id={id} name="yearly_income_id" options={lists.incomes} value={f.yearly_income_id ?? ""} onChange={(x) => set({ yearly_income_id: x ?? undefined })} placeholder={t.choose} />}</Field>
        <Field label={t.apply_first_time}>{(id) => (
          <select id={id} name="first_time_traveller" className={inputCls} value={f.first_time_traveller ?? 1} onChange={(e) => set({ first_time_traveller: Number(e.target.value) })}>
            <option value={1}>{t.yes}</option><option value={0}>{t.no}</option>
          </select>)}
        </Field>
      </section>

      <section className="grid gap-4 rounded-card border border-line bg-surface p-5 shadow-card sm:grid-cols-2">
        <h2 className="font-display text-lg font-bold sm:col-span-2">{t.apply_stay_title}</h2>
        <Field label={t.apply_stay_type}>{(id) => <Select id={id} name="place_of_stay_id" options={lists.stays} value={f.place_of_stay_id ?? ""} onChange={(x) => set({ place_of_stay_id: x ?? undefined })} placeholder={t.choose} />}</Field>
        <Field label={t.apply_stay_name}>{(id) => <input id={id} name="stay_name" required maxLength={50} value={f.stay_name ?? ""} onChange={(e) => set({ stay_name: e.target.value })} className={inputCls} />}</Field>
        <Field label={t.apply_city}>{(id) => <Select id={id} name="city_id" options={lists.cities} value={f.city_id ?? ""} onChange={city} placeholder={t.choose} />}</Field>
        <Field label={t.apply_district}>{(id) => <Select id={id} name="district_id" options={districts} value={f.district_id ?? ""} onChange={district} placeholder={busyGeo ? "…" : t.choose} disabled={!f.city_id} />}</Field>
        <Field label={t.apply_sub_district}>{(id) => <Select id={id} name="sub_district_id" options={subs} value={f.sub_district_id ?? ""} onChange={(x) => set({ sub_district_id: x ?? undefined })} placeholder={busyGeo ? "…" : t.choose} disabled={!f.district_id} />}</Field>
        <Field label={t.apply_pin}>{(id) => <input id={id} name="pin_code" required maxLength={10} inputMode="numeric" value={f.pin_code ?? ""} onChange={(e) => set({ pin_code: e.target.value })} className={inputCls} />}</Field>
        <Field label={t.apply_street} wide>{(id) => <input id={id} name="street" required maxLength={100} value={f.street ?? ""} onChange={(e) => set({ street: e.target.value })} className={inputCls} />}</Field>
        <Field label={t.apply_reference} hint={t.apply_reference_hint} wide>{(id) => <input id={id} name="reference" required maxLength={50} value={f.reference ?? ""} onChange={(e) => set({ reference: e.target.value })} className={inputCls} />}</Field>
      </section>
      <SubmitButton className="w-full">{t.apply_save_traveler}</SubmitButton>
    </ActionForm>
  );
}
