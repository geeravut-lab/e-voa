"use client";
import { useState } from "react";
import { AsyncButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { btnClass } from "@/components/buttonStyles";

type Pos = { lat: number; lon: number; acc: number };
/** Finds where the phone is and shows it on screen so it can be read out or copied. Nothing is sent to the server or stored. */
export function LocationBox() {
  const t = useT();
  const [pos, setPos] = useState<Pos | null>(null), [err, setErr] = useState(false), [copied, setCopied] = useState(false);
  const find = () => new Promise<void>((resolve) => {
    setErr(false); setPos(null);
    if (!("geolocation" in navigator)) { setErr(true); return resolve(); }
    navigator.geolocation.getCurrentPosition((p) => { setPos({ lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy) }); resolve(); }, () => { setErr(true); resolve(); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
  });
  const text = pos ? `${pos.lat.toFixed(6)}, ${pos.lon.toFixed(6)}` : "";
  return (
    <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="font-display text-lg font-bold">{t.emergency_share_loc}</h2>
      <p className="text-sm text-muted">{t.emergency_loc_note}</p>
      <AsyncButton variant="ghost" onClick={find}>{t.emergency_share_loc}</AsyncButton>
      <div aria-live="polite">
        {err && <p className="text-sm font-semibold text-gold-deep">{t.emergency_loc_denied}</p>}
        {pos && (
          <div className="space-y-2 rounded-control bg-sky p-3">
            <p className="font-mono text-lg font-bold tabular">{text}</p><p className="text-xs text-muted">± {pos.acc} m</p>
            <div className="flex flex-wrap gap-2">
              <AsyncButton variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* the number is on screen anyway */ } }}>{copied ? "✓" : t.emergency_loc_copy}</AsyncButton>
              <a href={`https://www.google.com/maps?q=${pos.lat},${pos.lon}`} target="_blank" rel="noopener noreferrer" className={btnClass("ghost")}>{t.emergency_loc_map}</a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
