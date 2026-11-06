"use client";
import { useRef, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { useT } from "@/components/I18n";
import type { MrzResult } from "@/lib/mrz";

/** "Take or choose a photo of the passport page": reads it on the device, then hands the checked fields to the form. */
export function PassportScanner({ onResult }: { onResult: (r: MrzResult) => void }) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [pct, setPct] = useState(0), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setMsg(null); setPct(0);
    try {
      const { scanPassportPhoto } = await import("@/lib/ocr-mrz");
      const out = await scanPassportPhoto(file, setPct);
      if (!out.result) setMsg({ ok: false, text: t.apply_scan_failed });
      else { onResult(out.result); setMsg(out.result.valid ? { ok: true, text: t.apply_mrz_ok } : { ok: false, text: t.apply_mrz_check_failed }); }
    } catch (e) { console.error("[scan]", (e as Error).message); setMsg({ ok: false, text: t.apply_scan_failed }); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept="image/*" capture="environment" className="sr-only" id="scan-input" onChange={(e) => pick(e.target.files?.[0])} />
      <label htmlFor="scan-input" aria-busy={busy} className={`pressable inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control bg-primary px-5 text-[15px] font-bold text-white ${busy ? "opacity-70" : ""}`}>
        {busy && <Spinner />}{busy ? `${t.apply_scan_reading} ${Math.round(pct * 100)}%` : t.apply_scan}
      </label>
      <p className="text-xs text-muted">{t.apply_scan_hint}</p>
      {msg && <p role="status" className={`rounded-control p-3 text-sm font-semibold ${msg.ok ? "bg-mint text-teal-deep" : "bg-gold-soft text-gold-deep"}`}>{msg.text}</p>}
    </div>
  );
}
