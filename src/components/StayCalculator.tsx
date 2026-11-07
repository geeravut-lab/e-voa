"use client";
import { useState } from "react";
import { useT } from "@/components/I18n";
import { inputCls } from "@/components/inputStyles";
import { daysLeft, stayEnd } from "@/lib/rules/rules";
import { stayLineFor, TONE } from "@/lib/rules/stay-text";


/** Entry date + days allowed → the last day and what is left. Runs in the browser; nothing is sent anywhere. */
export function StayCalculator({ defaultDays }: { defaultDays: number }) {
  const t = useT();
  const [date, setDate] = useState(""), [days, setDays] = useState(String(defaultDays));
  const n = Math.min(Math.max(Math.floor(Number(days)), 1), 365);
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(n) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
  const end = ok ? stayEnd(date, n) : null, left = end ? daysLeft(end, new Date()) : null;
  const started = ok ? daysLeft(date, new Date()) : null;
  const line = left !== null ? stayLineFor(t, left) : null;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-semibold">{t.stay_entry_date}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></label>
        <label className="block space-y-1 text-sm font-semibold">{t.stay_days_allowed}<input type="number" inputMode="numeric" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} className={`${inputCls} tabular`} /></label>
      </div>
      <div aria-live="polite" className="min-h-12">
        {end && line && (
          <div className="space-y-1 rounded-control bg-sky p-3">
            <p className="text-sm">{t.stay_last_day}: <b className="tabular">{end}</b></p>
            <p className={`font-display text-xl font-extrabold ${TONE[line.tone]}`}>{started !== null && started < 0 ? t.stay_not_yet.replace("{n}", String(-started)) : line.text}</p>
          </div>
        )}
      </div>
    </div>
  );
}
