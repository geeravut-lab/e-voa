"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppLink } from "./AppLink";
import { Spinner } from "./Spinner";
import { btnClass } from "./buttonStyles";
import { inputCls } from "./inputStyles";
import { useT } from "./I18n";

/** Range choice for the revenue page: five buttons, and two dates for a custom range. Everything lives in the address (?range=…&from=…&to=…) so the view can be linked and exported. */
export function RevenueFilter({ active, from, to }: { active: string; from: string; to: string }) {
  const t = useT(), router = useRouter();
  const [f, setF] = useState(from), [u, setU] = useState(to), [pending, start] = useTransition();
  const chips: [string, string][] = [["today", t.rev_today], ["week", t.rev_week], ["month", t.rev_month], ["year", t.rev_year]];
  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.rev_range}>
        {chips.map(([k, label]) => <AppLink key={k} href={`/admin/revenue?range=${k}`} aria-current={active === k ? "true" : undefined} className={btnClass(active === k ? "primary" : "ghost", "min-h-10 px-4")}>{label}</AppLink>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (f && u) start(() => router.push(`/admin/revenue?range=custom&from=${f}&to=${u}`)); }} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1"><span className="block text-xs font-semibold text-muted">{t.rev_from}</span><input type="date" required value={f} max={u || undefined} onChange={(e) => setF(e.target.value)} className={`${inputCls} w-auto`} /></label>
        <label className="space-y-1"><span className="block text-xs font-semibold text-muted">{t.rev_to}</span><input type="date" required value={u} min={f || undefined} onChange={(e) => setU(e.target.value)} className={`${inputCls} w-auto`} /></label>
        <button type="submit" disabled={pending || !f || !u} aria-busy={pending} className={btnClass(active === "custom" ? "primary" : "ghost", "min-h-11 px-5")}>{pending && <Spinner />}{t.rev_custom}</button>
      </form>
    </div>
  );
}
