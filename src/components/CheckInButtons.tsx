"use client";
import { useState } from "react";
import { AsyncButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { errorText } from "@/lib/i18n/dict";
import { btnClass } from "@/components/buttonStyles";
import { checkInAction } from "@/app/actions/family";

type Words = { safe: string; help: string; helpTitle: string; helpText: string; helpPos: string; helpSend: string; cancel: string };
/** The two big buttons. "I need help" opens a short confirmation first (so it is never pressed by accident) and can add the position, taken here in the browser. */
export function CheckInButtons({ w }: { w: Words }) {
  const t = useT();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null), [open, setOpen] = useState(false), [withPos, setWithPos] = useState(false);
  const run = async (status: "safe" | "help", pos: { lat: number; lon: number } | null) => {
    setMsg(null);
    const r = await checkInAction(status, pos);
    setMsg(r?.ok ? { ok: true, text: r.message ?? "✓" } : { ok: false, text: errorText(r && !r.ok ? r.error : "err_generic", t) });
    if (r?.ok && status === "help") setOpen(false);
  };
  const send = async () => {
    let pos: { lat: number; lon: number } | null = null;
    if (withPos && "geolocation" in navigator) pos = await new Promise((res) => navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }), () => res(null), { timeout: 12_000, maximumAge: 60_000 }));
    await run("help", pos);
  };
  return (
    <div className="space-y-3">
      <AsyncButton variant="primary" className="min-h-16 w-full text-xl" onClick={() => run("safe", null)}>✓ {w.safe}</AsyncButton>
      {!open ? <button type="button" className={btnClass("danger", "w-full")} onClick={() => setOpen(true)}>{w.help}</button> : (
        <div className="space-y-3 rounded-card border-2 border-danger bg-danger-bg p-4" role="group" aria-label={w.helpTitle}>
          <h3 className="font-display text-lg font-bold text-danger">{w.helpTitle}</h3>
          <p className="text-sm">{w.helpText}</p>
          <label className="flex min-h-11 items-start gap-3 text-sm font-semibold"><input type="checkbox" checked={withPos} onChange={(e) => setWithPos(e.target.checked)} className="mt-0.5 h-5 w-5" />{w.helpPos}</label>
          <div className="flex flex-wrap gap-2"><AsyncButton variant="danger" onClick={send}>{w.helpSend}</AsyncButton><button type="button" className={btnClass("ghost")} onClick={() => setOpen(false)}>{w.cancel}</button></div>
        </div>
      )}
      <div aria-live="polite" className="min-h-6 text-sm font-semibold">{msg && <span className={msg.ok ? "text-success" : "text-danger"}>{msg.ok ? "✓ " : "✕ "}{msg.text}</span>}</div>
    </div>
  );
}
