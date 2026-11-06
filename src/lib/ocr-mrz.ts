"use client";
import { parseMrz, type MrzResult } from "@/lib/mrz";

// Reads the passport's machine-readable lines from a photo, inside the browser (Tesseract compiled to WebAssembly, files served from /ocr).
// The picture never leaves the device. Every result is checked with the passport's own check digits (lib/mrz), so a misread letter is caught, not trusted.

export type ScanOutcome = { result: MrzResult | null; text: string };
type Worker = { setParameters: (p: Record<string, string>) => Promise<unknown>; recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };

async function load(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try { const img = new Image(); img.src = url; await img.decode(); return img; } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

/** The bottom `fraction` of the photo, scaled to a good reading size, in grey with the contrast stretched. */
function strip(img: HTMLImageElement, fraction: number): HTMLCanvasElement {
  const sh = Math.round(img.naturalHeight * fraction), sy = img.naturalHeight - sh;
  const w = Math.min(2000, Math.max(1400, img.naturalWidth)), h = Math.round((sh * w) / img.naturalWidth);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, sy, img.naturalWidth, sh, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), px = d.data; let lo = 255, hi = 0;
  for (let i = 0; i < px.length; i += 4) { const v = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) | 0; px[i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = Math.max(hi - lo, 1);
  for (let i = 0; i < px.length; i += 4) { const v = Math.round(((px[i] - lo) / span) * 255); px[i] = px[i + 1] = px[i + 2] = v; }
  g.putImageData(d, 0, 0);
  return c;
}

export async function scanPassportPhoto(file: File, onProgress?: (p: number) => void): Promise<ScanOutcome> {
  const { createWorker } = await import("tesseract.js");
  const origin = window.location.origin;
  const worker = (await createWorker("eng", 1, { workerPath: `${origin}/ocr/worker.min.js`, corePath: `${origin}/ocr/core`, langPath: `${origin}/ocr/lang`, workerBlobURL: false, gzip: true,
    logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") onProgress?.(m.progress); } })) as unknown as Worker;
  try {
    await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<", tessedit_pageseg_mode: "6", preserve_interword_spaces: "0" });
    const img = await load(file);
    let best: ScanOutcome = { result: null, text: "" };
    for (const fraction of [0.22, 0.32, 0.45]) {                       // the two lines sit at the very bottom of the data page; try tighter and looser crops
      const { data } = await worker.recognize(strip(img, fraction));
      const result = parseMrz(data.text);
      if (result?.valid) return { result, text: data.text };
      if (result && !best.result) best = { result, text: data.text };
      if (!best.text) best.text = data.text;
    }
    return best;
  } finally { await worker.terminate(); }
}
