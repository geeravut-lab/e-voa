"use client";
import { useState, useTransition } from "react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { Spinner } from "@/components/Spinner";
import { useT } from "@/components/I18n";
import { lookupFlightAction, saveTripAction } from "@/app/actions/apply";
import { Field, Select, inputCls, type Opt } from "./fields";
import { packageAvailability, arrivalInstant, applicationFees, type Fees } from "@/lib/pricing";

type Trip = { id?: string; package?: string; arrival_airport_id?: number | null; arrival_date?: string; arrival_time?: string | null; arrival_flight_no?: string | null; arrival_airline_id?: number | null; departure_date?: string | null; departure_time?: string | null; departure_flight_no?: string | null; departure_airline_id?: number | null; purpose_id?: number | null; boarded_country_id?: number | null; next_city?: string | null; type_of_flight_id?: number | null };

/** Step 1: when and how you arrive, and which package. The flight number fills in airline, airport and time. */
export function TripForm({ trip, airports, airlines, purposes, countries, fees, canLookup }: { trip: Trip; airports: Opt[]; airlines: Opt[]; purposes: Opt[]; countries: Opt[]; fees: Fees; canLookup: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [arrDate, setArrDate] = useState(trip.arrival_date ?? ""), [arrTime, setArrTime] = useState(trip.arrival_time ?? "");
  const [flight, setFlight] = useState(trip.arrival_flight_no ?? ""), [airport, setAirport] = useState<number | string>(trip.arrival_airport_id ?? ""), [airline, setAirline] = useState<number | string>(trip.arrival_airline_id ?? "");
  const [pkg, setPkg] = useState<"regular" | "express">((trip.package as "regular" | "express") ?? "regular");
  const [note, setNote] = useState<string | null>(null);
  const av = arrDate ? packageAvailability(new Date(), arrivalInstant(arrDate, arrTime)) : null;
  const price = (p: "regular" | "express") => applicationFees(fees, p);

  const lookup = () => start(async () => {
    setNote(null);
    const f = await lookupFlightAction(flight, arrDate);
    if (!f) return setNote(t.apply_flight_not_found);
    setAirline(f.airlineId ?? ""); setAirport(f.arrivalAirportId ?? ""); setArrTime(f.arrivalTime);
    setNote(t.apply_flight_found.replace("{airline}", f.airlineName).replace("{time}", f.arrivalTime));
  });

  return (
    <ActionForm action={saveTripAction} className="space-y-5">
      {trip.id && <input type="hidden" name="tripId" value={trip.id} />}
      <section className="grid gap-4 rounded-card border border-line bg-surface p-5 shadow-card sm:grid-cols-2">
        <h2 className="font-display text-lg font-bold sm:col-span-2">{t.apply_arrival}</h2>
        <Field label={t.apply_arrival_date}>{(id) => <input id={id} name="arrival_date" type="date" required value={arrDate} onChange={(e) => setArrDate(e.target.value)} className={inputCls} />}</Field>
        <Field label={t.apply_flight_no} hint={canLookup ? t.apply_flight_hint : undefined}>
          {(id) => (
            <div className="flex gap-2">
              <input id={id} name="arrival_flight_no" required value={flight} onChange={(e) => setFlight(e.target.value.toUpperCase())} placeholder="TG316" className={inputCls} />
              {canLookup && <button type="button" onClick={lookup} disabled={pending || !flight || !arrDate} aria-busy={pending} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control border-[1.5px] border-sky-line bg-surface px-4 text-sm font-bold text-primary disabled:opacity-60">{pending && <Spinner size={14} />}{t.apply_flight_find}</button>}
            </div>
          )}
        </Field>
        {note && <p className="rounded-control bg-mint p-3 text-sm text-teal-deep sm:col-span-2" role="status">{note}</p>}
        <Field label={t.apply_arrival_airport}>{(id) => <Select id={id} name="arrival_airport_id" options={airports} value={airport} onChange={(v) => setAirport(v ?? "")} placeholder={t.choose} />}</Field>
        <Field label={t.apply_arrival_time}>{(id) => <input id={id} name="arrival_time" type="time" value={arrTime} onChange={(e) => setArrTime(e.target.value)} className={inputCls} />}</Field>
        <Field label={t.apply_airline}>{(id) => <Select id={id} name="arrival_airline_id" options={airlines} value={airline} onChange={(v) => setAirline(v ?? "")} placeholder={t.choose} />}</Field>
        <Field label={t.apply_from_country}>{(id) => <Select id={id} name="boarded_country_id" options={countries} defaultValue={trip.boarded_country_id} placeholder={t.choose} />}</Field>
        <Field label={t.apply_purpose}>{(id) => <Select id={id} name="purpose_id" options={purposes} defaultValue={trip.purpose_id} placeholder={t.choose} />}</Field>
        <Field label={t.apply_next_city}>{(id) => <input id={id} name="next_city" required defaultValue={trip.next_city ?? ""} className={inputCls} />}</Field>
        <input type="hidden" name="type_of_flight_id" value={trip.type_of_flight_id ?? 2} />
      </section>

      <section className="grid gap-4 rounded-card border border-line bg-surface p-5 shadow-card sm:grid-cols-2">
        <h2 className="font-display text-lg font-bold sm:col-span-2">{t.apply_departure}</h2>
        <Field label={t.apply_departure_date} hint={t.apply_stay_hint}>{(id) => <input id={id} name="departure_date" type="date" required defaultValue={trip.departure_date ?? ""} className={inputCls} />}</Field>
        <Field label={t.apply_flight_no}>{(id) => <input id={id} name="departure_flight_no" required defaultValue={trip.departure_flight_no ?? ""} placeholder="TG317" className={inputCls} />}</Field>
        <Field label={t.apply_arrival_time}>{(id) => <input id={id} name="departure_time" type="time" defaultValue={trip.departure_time ?? ""} className={inputCls} />}</Field>
        <Field label={t.apply_airline}>{(id) => <Select id={id} name="departure_airline_id" options={airlines} defaultValue={trip.departure_airline_id} placeholder={t.choose} />}</Field>
      </section>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-display text-lg font-bold">{t.apply_package}</legend>
        <input type="hidden" name="package" value={pkg} />
        {(["regular", "express"] as const).map((p) => {
          const ok = !av || av[p]; const on = pkg === p && ok;
          return (
            <label key={p} className={`block cursor-pointer rounded-card border-2 p-4 shadow-card ${on ? "border-primary bg-sky" : "border-line bg-surface"} ${ok ? "" : "cursor-not-allowed opacity-60"}`}>
              <input type="radio" name="pkg_ui" className="sr-only" checked={on} disabled={!ok} onChange={() => setPkg(p)} />
              <span className="flex items-center justify-between gap-3"><b className="font-display text-lg">{p === "regular" ? t.apply_pkg_regular : t.apply_pkg_express}</b><b className="tabular text-lg">THB {price(p).total.toLocaleString("en-US")}</b></span>
              <span className="block text-sm text-muted">{p === "regular" ? t.apply_pkg_regular_sub : t.apply_pkg_express_sub}</span>
              <span className="block text-xs text-muted">{t.apply_price_split.replace("{visa}", price(p).visa.toLocaleString("en-US")).replace("{service}", price(p).service.toLocaleString("en-US"))}</span>
              {!ok && <span className="mt-1 block text-sm font-semibold text-gold-deep">{av?.reason === "in_past" ? t.apply_pkg_past : t.apply_pkg_too_late}</span>}
            </label>
          );
        })}
        {av && !av.regular && av.express && <p className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{t.apply_express_only}</p>}
      </fieldset>
      <SubmitButton className="w-full" disabled={!!av && !av[pkg]}>{t.apply_next}</SubmitButton>
    </ActionForm>
  );
}
