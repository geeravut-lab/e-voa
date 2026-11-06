import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { analyzePhoto } from "@/lib/photo-check";

// A "face-like" test picture: soft light background with a darker textured oval. Real photos will differ; these tests pin the measuring logic.
async function picture(opts: { w?: number; h?: number; bg?: number; blur?: number; texture?: boolean }) {
  const w = opts.w ?? 600, h = opts.h ?? 800, bg = opts.bg ?? 190;
  const rects = Array.from({ length: 160 }, (_, i) => `<rect x="${Math.round(w * 0.2 + ((i * 37) % (w * 0.6)))}" y="${Math.round(h * 0.25 + ((i * 91) % (h * 0.6)))}" width="${20 + (i % 5) * 6}" height="${14 + (i % 4) * 8}" fill="rgb(${(i * 53) % 200},${(i * 29) % 160},${(i * 71) % 220})"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="rgb(${bg},${bg},${bg})"/>${opts.texture === false ? "" : rects}</svg>`;
  let img = sharp(Buffer.from(svg)).jpeg({ quality: 92 });
  let buf = await img.toBuffer();
  if (opts.blur) buf = await sharp(buf).blur(opts.blur).jpeg().toBuffer();
  return new Uint8Array(buf);
}

describe("photo quality check", () => {
  it("accepts a sharp, well-lit portrait picture", async () => { const r = await analyzePhoto(await picture({})); expect(r?.warnings).toEqual([]); });
  it("warns about a blurred picture", async () => { expect((await analyzePhoto(await picture({ blur: 12 })))?.warnings).toContain("blurry"); });
  it("warns about too dark and too bright light", async () => {
    expect((await analyzePhoto(await picture({ bg: 20, texture: false })))?.warnings).toContain("dark");
    expect((await analyzePhoto(await picture({ bg: 250, texture: false })))?.warnings).toContain("bright");
  });
  it("warns about a flat picture, a small one and a landscape one", async () => {
    expect((await analyzePhoto(await picture({ texture: false })))?.warnings).toContain("flat");
    expect((await analyzePhoto(await picture({ w: 300, h: 380 })))?.warnings).toContain("small");
    expect((await analyzePhoto(await picture({ w: 900, h: 600 })))?.warnings).toContain("landscape");
  });
  it("warns about a dark or busy background", async () => {
    expect((await analyzePhoto(await picture({ bg: 90 })))?.warnings).toContain("background");
    const busy = Array.from({ length: 300 }, (_, i) => `<rect x="${(i * 53) % 600}" y="${(i * 29) % 800}" width="40" height="40" fill="rgb(${(i * 53) % 255},${(i * 91) % 255},${(i * 17) % 255})"/>`).join("");
    const buf = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="100%" height="100%" fill="rgb(200,200,200)"/>${busy}</svg>`)).jpeg().toBuffer();
    expect((await analyzePhoto(new Uint8Array(buf)))?.warnings).toContain("background");
  });
  it("returns null for something that is not a picture", async () => { expect(await analyzePhoto(new Uint8Array([1, 2, 3]))).toBeNull(); });
});
