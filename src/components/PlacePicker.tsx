"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AsyncButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { inputCls } from "@/components/inputStyles";
import { nearestPlace, PLACES } from "@/lib/conditions/places";

/** Choose a place, or let the phone pick the nearest one. The position is used here in the browser only to choose from our list; it is never sent to the server. */
export function PlacePicker({ current, lang }: { current: string; lang: string }) {
  const t = useT(), router = useRouter(), [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const go = (slug: string) => start(() => router.push(`/conditions?place=${slug}`));
  const name = (p: (typeof PLACES)[number]) => (lang === "th" ? p.name.th : lang === "zh-CN" || lang === "zh-TW" ? p.name["zh-CN"] : p.name.en);
  const locate = () => new Promise<void>((resolve) => {
    setMsg(t.cond_locating);
    if (!("geolocation" in navigator)) { setMsg(t.emergency_loc_denied); return resolve(); }
    navigator.geolocation.getCurrentPosition((pos) => {
      const p = nearestPlace(pos.coords.latitude, pos.coords.longitude);
      if (p) { setMsg(null); go(p.slug); } else setMsg(t.cond_no_near);
      resolve();
    }, () => { setMsg(t.emergency_loc_denied); resolve(); }, { timeout: 15_000, maximumAge: 300_000 });
  });
  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
      <label className="block space-y-1 text-sm font-semibold">{t.cond_place}
        <select value={current} onChange={(e) => go(e.target.value)} aria-busy={pending} className={inputCls}>{PLACES.map((p) => <option key={p.slug} value={p.slug}>{name(p)}</option>)}</select></label>
      <AsyncButton variant="ghost" onClick={locate}>{t.cond_use_location}</AsyncButton>
      <p aria-live="polite" className="min-h-5 text-sm font-semibold text-gold-deep">{msg}</p>
    </div>
  );
}
