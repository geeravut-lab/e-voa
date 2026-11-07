"use client";
import { useState } from "react";
import { AsyncButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { errorText } from "@/lib/i18n/dict";

const W = 400, H = 560, SCALE = 3;                                    // the card is 400×560; the picture is 1200×1680 so the QR stays sharp on any phone
/** The pass card as a PNG picture. The card comes from the server as an SVG; it is drawn here so the text uses the phone's own fonts, then saved as PNG (an SVG file cannot be opened in the gallery or most viewers). */
export async function passCardPng(href: string): Promise<Blob> {
  const res = await fetch(href, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(`card ${res.status}`);
  const url = URL.createObjectURL(new Blob([await res.text()], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image(); img.decoding = "async"; img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas"); canvas.width = W * SCALE; canvas.height = H * SCALE;
    const g = canvas.getContext("2d"); if (!g) throw new Error("no canvas");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, canvas.width, canvas.height);              // no transparent corners: a gallery shows transparency as black
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("no png"))), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

/** "Save to phone": on a phone the share sheet offers "Save image"; elsewhere the PNG downloads. */
export function SavePassButton({ href, filename }: { href: string; filename: string }) {
  const t = useT();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <AsyncButton variant="gold" onClick={async () => {
        setErr(null);
        try {
          const png = await passCardPng(href), file = new File([png], filename, { type: "image/png" });
          if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: filename }); return; } catch (e) { if ((e as Error).name === "AbortError") return; /* sharing failed: fall back to a download */ }
          }
          const a = document.createElement("a"); a.href = URL.createObjectURL(png); a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        } catch { setErr(errorText("err_generic", t)); }
      }}>{t.pass_save}</AsyncButton>
      {err && <p role="alert" className="w-full text-center text-sm font-semibold text-danger">✕ {err}</p>}
    </>
  );
}
