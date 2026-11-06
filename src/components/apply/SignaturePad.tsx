"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/I18n";

/** Draw the signature with a finger or mouse. The picture goes into a hidden field as a small PNG; "Clear" starts again. */
export function SignaturePad({ name = "signature", onInk }: { name?: string; onInk?: (has: boolean) => void }) {
  const t = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  const [value, setValue] = useState("");
  const drawing = useRef(false), last = useRef<{ x: number; y: number } | null>(null), ink = useRef(false);

  useEffect(() => {
    const c = ref.current!; const ratio = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.offsetWidth * ratio; c.height = c.offsetHeight * ratio;
    const g = c.getContext("2d")!; g.scale(ratio, ratio); g.lineWidth = 2.2; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "rgb(20,30,50)";
  }, []);

  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => { drawing.current = true; last.current = pos(e); ref.current!.setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const g = ref.current!.getContext("2d")!, p = pos(e);
    g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke(); last.current = p;
    if (!ink.current) { ink.current = true; onInk?.(true); }
  };
  const up = () => { if (!drawing.current) return; drawing.current = false; last.current = null; if (ink.current) setValue(ref.current!.toDataURL("image/png")); };
  const clear = () => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); ink.current = false; setValue(""); onInk?.(false); };

  return (
    <div className="space-y-2">
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label={t.sign_pad_label} className="h-36 w-full touch-none rounded-control border-[1.5px] border-dashed border-field bg-surface" />
      <input type="hidden" name={name} value={value} />
      <button type="button" onClick={clear} className="min-h-11 text-sm font-semibold text-primary">{t.sign_clear}</button>
    </div>
  );
}
