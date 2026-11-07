"use client";
import { useEffect, useRef, useState } from "react";
import { AsyncButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { btnClass } from "@/components/buttonStyles";
import { inputCls } from "@/components/inputStyles";
import { stampFileName, stampLines } from "@/lib/photo-stamp";

export type ClientGroup = { id: string; title: string; items: { id: string; text: string }[] };
export type ClientSlot = { id: string; label: string };
const KEY = "evoa-rental-checklist-v1";
const MAX_SIDE = 1600;

/** The photo with the time (and place) printed on it, as a JPEG. The picture never leaves the phone. */
async function stamped(file: File, lines: string[]): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); if (!g) throw new Error("no canvas");
  g.drawImage(bmp, 0, 0, w, h); bmp.close?.();
  const size = Math.max(14, Math.round(w / 38)), pad = Math.round(size * 0.6), band = lines.length * (size + 4) + pad * 2;
  g.fillStyle = "rgba(0,0,0,0.62)"; g.fillRect(0, h - band, w, band);
  g.fillStyle = "#ffffff"; g.font = `600 ${size}px system-ui, sans-serif`; g.textBaseline = "top";
  lines.forEach((l, i) => g.fillText(l, pad, h - band + pad + i * (size + 4), w - pad * 2));
  return await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("no jpeg"))), "image/jpeg", 0.88));
}

export function RentalHelper({ groups, slots }: { groups: ClientGroup[]; slots: ClientSlot[] }) {
  const t = useT();
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(KEY) ?? "{}")); } catch { /* the checklist just starts empty */ } }, []);
  const toggle = (id: string) => setDone((d) => { const n = { ...d, [id]: !d[id] }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* storage blocked: the ticks last until the page closes */ } return n; });
  const count = Object.values(done).filter(Boolean).length;

  const [shop, setShop] = useState(""), [pos, setPos] = useState<{ lat: number; lon: number } | null>(null), [posErr, setPosErr] = useState(false);
  const [photos, setPhotos] = useState<Record<string, { blob: Blob; url: string; at: Date }>>({}), [err, setErr] = useState<string | null>(null), [saved, setSaved] = useState<number | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const addPos = () => new Promise<void>((resolve) => {
    setPosErr(false);
    if (!("geolocation" in navigator)) { setPosErr(true); return resolve(); }
    navigator.geolocation.getCurrentPosition((p) => { setPos({ lat: p.coords.latitude, lon: p.coords.longitude }); resolve(); }, () => { setPosErr(true); resolve(); }, { timeout: 15_000, maximumAge: 120_000 });
  });
  const onPick = async (slot: ClientSlot, f: File | undefined) => {
    if (!f) return; setErr(null); setSaved(null);
    try {
      const at = new Date(), blob = await stamped(f, stampLines({ when: at, shop, slot: slot.label, pos })), url = URL.createObjectURL(blob);
      urls.current.push(url); setPhotos((p) => ({ ...p, [slot.id]: { blob, url, at } }));
    } catch { setErr(t.rental_photo_error); }
  };
  const list = slots.filter((s) => photos[s.id]);
  const saveAll = async () => {
    setErr(null);
    const files = list.map((s, i) => new File([photos[s.id].blob], stampFileName(s.id, photos[s.id].at, i), { type: "image/jpeg" }));
    try {
      for (const f of files) { const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000); await new Promise((r) => setTimeout(r, 250)); }
      setSaved(files.length);
    } catch { setErr(t.rental_photo_error); }
  };
  const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card";
  return (
    <div className="space-y-4">
      <section className={box} aria-label={t.rental_checklist}>
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-lg font-bold">{t.rental_checklist}</h2><p className="text-sm font-semibold text-success" role="status">{t.rental_progress.replace("{done}", String(count)).replace("{total}", String(total))}</p></div>
        {groups.map((g) => (
          <fieldset key={g.id} className="space-y-1"><legend className="mb-1 font-display text-base font-bold text-primary">{g.title}</legend>
            {g.items.map((it) => (
              <label key={it.id} className="flex min-h-11 items-start gap-3 rounded-control border border-line p-3 text-[15px]"><input type="checkbox" checked={!!done[`${g.id}.${it.id}`]} onChange={() => toggle(`${g.id}.${it.id}`)} className="mt-1 h-5 w-5 shrink-0" /><span>{it.text}</span></label>
            ))}
          </fieldset>
        ))}
      </section>
      <section className={box} aria-label={t.rental_photos}>
        <h2 className="font-display text-lg font-bold">{t.rental_photos}</h2>
        <p className="text-sm text-muted">{t.rental_photos_hint}</p>
        <label className="block space-y-1 text-sm font-semibold">{t.rental_shop}<input value={shop} onChange={(e) => setShop(e.target.value)} maxLength={60} className={inputCls} autoComplete="off" /></label>
        <div className="flex flex-wrap items-center gap-3"><AsyncButton variant="ghost" onClick={addPos}>{pos ? `✓ ${t.rental_position_added}` : t.rental_add_position}</AsyncButton>{posErr && <span className="text-sm font-semibold text-gold-deep">{t.emergency_loc_denied}</span>}</div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {slots.map((s) => { const ph = photos[s.id]; return (
            <li key={s.id} className="space-y-1">
              <span className="block text-xs font-semibold">{s.label}</span>
              {ph ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={ph.url} alt={s.label} className="aspect-square w-full rounded-control border border-line object-cover" /> : <span className="grid aspect-square w-full place-items-center rounded-control border border-dashed border-field text-xs text-muted">—</span>}
              <label className={`${btnClass(ph ? "ghost" : "primary", "w-full cursor-pointer text-sm")} min-h-11`}>{ph ? t.rental_retake : t.rental_take}
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void onPick(s, e.target.files?.[0]); e.target.value = ""; }} /></label>
            </li>); })}
        </ul>
        {list.length > 0 && <div className="flex flex-wrap gap-2"><AsyncButton variant="gold" onClick={saveAll}>{t.rental_save_all} ({list.length})</AsyncButton>
          <button type="button" className={btnClass("ghost")} onClick={() => { setPhotos({}); setSaved(null); }}>{t.rental_clear}</button></div>}
        <div aria-live="polite" className="min-h-5 text-sm font-semibold">{saved !== null && <span className="text-success">✓ {t.rental_saved.replace("{n}", String(saved))}</span>}{err && <span className="text-danger">✕ {err}</span>}</div>
        <p className="rounded-control bg-gold-soft p-3 text-xs font-semibold text-gold-deep">{t.rental_note}</p>
      </section>
    </div>
  );
}
