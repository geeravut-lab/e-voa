import sharp from "sharp";

// A quick quality look at the face photo (no face detection: only what can be measured without a model): size, orientation, light, contrast, sharpness.
// The numbers are practical starting points and can be tuned; problems are shown as advice, the traveler can still keep the photo.
export type PhotoWarning = "small" | "landscape" | "dark" | "bright" | "flat" | "blurry" | "background";
export type PhotoCheck = { width: number; height: number; warnings: PhotoWarning[]; stats: { mean: number; stdev: number; sharpness: number } };

export const THRESHOLDS = { minSide: 350, minMean: 70, maxMean: 215, minStdev: 28, minSharpness: 40, minBackground: 150, maxBackgroundSpread: 32 };

/** Variance of a simple Laplacian over a grey picture: high = sharp edges, low = blurred. */
export function sharpnessOf(grey: Uint8Array, w: number, h: number): number {
  let sum = 0, sum2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, v = 4 * grey[i] - grey[i - 1] - grey[i + 1] - grey[i - w] - grey[i + w];
    sum += v; sum2 += v * v; n++;
  }
  const mean = sum / n; return sum2 / n - mean * mean;
}

/** The background is read from the picture's top edge and the upper sides (where the head and shoulders are not): it should be light and plain. */
export function backgroundOf(grey: Uint8Array, w: number, h: number): { mean: number; stdev: number } {
  let s = 0, s2 = 0, n = 0;
  const take = (x0: number, x1: number, y0: number, y1: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = grey[y * w + x]; s += v; s2 += v * v; n++; } };
  take(0, w, 0, Math.max(Math.floor(h * 0.1), 1));                                         // top strip
  take(0, Math.max(Math.floor(w * 0.07), 1), 0, Math.floor(h * 0.6));                       // left strip, upper part
  take(w - Math.max(Math.floor(w * 0.07), 1), w, 0, Math.floor(h * 0.6));                   // right strip, upper part
  const mean = s / n; return { mean, stdev: Math.sqrt(Math.max(s2 / n - mean * mean, 0)) };
}

export async function analyzePhoto(bytes: Uint8Array): Promise<PhotoCheck | null> {
  try {
    const img = sharp(bytes).rotate();                                   // respect the phone's orientation flag
    const meta = await img.metadata();
    const { data, info } = await img.clone().greyscale().resize({ width: 320, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
    const grey = new Uint8Array(data); let s = 0, s2 = 0;
    for (const v of grey) { s += v; s2 += v * v; }
    const mean = s / grey.length, stdev = Math.sqrt(Math.max(s2 / grey.length - mean * mean, 0)), sharpness = sharpnessOf(grey, info.width, info.height);
    const rotated = (meta.orientation ?? 1) >= 5;
    const width = (rotated ? meta.height : meta.width) ?? 0, height = (rotated ? meta.width : meta.height) ?? 0;
    const warnings: PhotoWarning[] = [];
    if (Math.min(width, height) < THRESHOLDS.minSide) warnings.push("small");
    if (width > height * 1.1) warnings.push("landscape");
    if (mean < THRESHOLDS.minMean) warnings.push("dark"); else if (mean > THRESHOLDS.maxMean) warnings.push("bright");
    if (stdev < THRESHOLDS.minStdev) warnings.push("flat");
    if (sharpness < THRESHOLDS.minSharpness) warnings.push("blurry");
    const bg = backgroundOf(grey, info.width, info.height);
    if (bg.mean < THRESHOLDS.minBackground || bg.stdev > THRESHOLDS.maxBackgroundSpread) warnings.push("background");
    return { width, height, warnings, stats: { mean: Math.round(mean), stdev: Math.round(stdev), sharpness: Math.round(sharpness) } };
  } catch { return null; }
}
