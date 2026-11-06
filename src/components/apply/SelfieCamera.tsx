"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/I18n";
import { Spinner } from "@/components/Spinner";
import { btnClass } from "@/components/buttonStyles";

const RATIO = 3 / 4;          // portrait, like a passport photo

/** Takes a face photo with the device camera. Hands back a JPEG File (cropped to 3:4, not mirrored); the normal upload flow and face check take it from there. */
export function SelfieCamera({ onCapture, onClose }: { onCapture: (f: File) => void; onClose: () => void }) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"starting" | "live" | "error">("starting"), [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const stop = () => { stream.current?.getTracks().forEach((x) => x.stop()); stream.current = null; };

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1440 }, height: { ideal: 1920 } }, audio: false });
        if (dead) { s.getTracks().forEach((x) => x.stop()); return; }
        stream.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
        setState("live");
      } catch { if (!dead) setState("error"); }
    })();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { dead = true; stop(); document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once
  }, []);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const snap = () => {
    const v = video.current; if (!v || !v.videoWidth) return;
    let w = v.videoWidth, h = Math.round(w / RATIO), sx = 0, sy = 0;
    if (h > v.videoHeight) { h = v.videoHeight; w = Math.round(h * RATIO); sx = Math.round((v.videoWidth - w) / 2); } else sy = Math.round((v.videoHeight - h) / 2);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(v, sx, sy, w, h, 0, 0, w, h);
    c.toBlob((b) => { if (b) setShot({ blob: b, url: URL.createObjectURL(b) }); }, "image/jpeg", 0.92);
  };
  const use = () => { if (!shot) return; onCapture(new File([shot.blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" })); stop(); onClose(); };

  return (
    <div role="dialog" aria-modal="true" aria-label={t.selfie_title} className="fixed inset-0 z-50 flex flex-col items-center bg-ink/90 p-3 text-white">
      <div className="flex w-full max-w-md items-center justify-between gap-2 pb-2"><p className="font-semibold">{t.selfie_title}</p><button type="button" onClick={onClose} className="rounded-control bg-white/15 px-4 py-2 font-semibold text-white">{t.selfie_cancel}</button></div>
      <div className="relative flex min-h-0 w-full max-w-md flex-1 items-center justify-center">
        {state === "error" ? <p role="alert" className="rounded-control bg-surface p-4 text-sm font-semibold text-danger">{t.selfie_denied}</p> : (
          <div className="relative max-h-full overflow-hidden rounded-card bg-ink" style={{ aspectRatio: "3 / 4", height: "100%", maxWidth: "100%" }}>
            {/* the video stays mounted while the captured picture is shown over it, so "retake" needs no new camera start */}
            <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            {/* eslint-disable-next-line @next/next/no-img-element -- local capture preview */}
            {shot && <img src={shot.url} alt={t.selfie_title} className="absolute inset-0 h-full w-full object-cover" />}
            {!shot && state === "live" && <div aria-hidden className="pointer-events-none absolute left-1/2 top-[46%] h-[62%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 border-dashed border-white/80" />}
            {state === "starting" && <div className="absolute inset-0 flex items-center justify-center gap-2"><Spinner size={22} className="text-white" />{t.selfie_starting}</div>}
          </div>
        )}
      </div>
      <p className="max-w-md py-2 text-center text-sm">{t.selfie_hint}</p>
      <div className="grid w-full max-w-md grid-cols-2 gap-2">
        {shot ? (<><button type="button" onClick={() => setShot(null)} className={btnClass("ghost")}>{t.selfie_retake}</button><button type="button" onClick={use} className={btnClass("gold")}>{t.selfie_use}</button></>)
          : (<button type="button" disabled={state !== "live"} onClick={snap} className={`${btnClass("gold")} col-span-2 disabled:opacity-50`}>{t.selfie_capture}</button>)}
      </div>
    </div>
  );
}
