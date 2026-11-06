import { describe, expect, it } from "vitest";
import { applyBrandName, brandToColumn, checkFavicon, checkLogo, DEFAULT_BRAND, parseBrand, validBrandName } from "./brand";

function png(w: number, h: number, extra = 0): Uint8Array {
  const b = new Uint8Array(33 + extra);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const dv = new DataView(b.buffer);
  dv.setUint32(8, 13); b.set([0x49, 0x48, 0x44, 0x52], 12);
  dv.setUint32(16, w); dv.setUint32(20, h);
  return b;
}

describe("brand name", () => {
  it("validates length and characters", () => {
    expect(validBrandName("ThaiPass e-VOA")).toBe(true);
    expect(validBrandName("")).toBe(false);
    expect(validBrandName("   ")).toBe(false);
    expect(validBrandName("a".repeat(41))).toBe(false);
    expect(validBrandName("<b>x</b>")).toBe(false);
    expect(validBrandName("two\nlines")).toBe(false);
  });
  it("applyBrandName swaps once, even when the new name contains the old one", () => {
    expect(applyBrandName("Welcome to ThaiPass e-VOA", "ThaiPass e-VOA Plus")).toBe("Welcome to ThaiPass e-VOA Plus");
    expect(applyBrandName("ThaiPass e-VOA and ThaiPass e-VOA", "X")).toBe("X and X");
    expect(applyBrandName("unchanged", "ThaiPass e-VOA")).toBe("unchanged");
  });
});

describe("parseBrand / brandToColumn", () => {
  it("survives garbage", () => {
    expect(parseBrand(null)).toEqual(DEFAULT_BRAND);
    expect(parseBrand("x")).toEqual(DEFAULT_BRAND);
    expect(parseBrand({ name: 5, logo: { mime: 1 } })).toEqual(DEFAULT_BRAND);
  });
  it("stores only differences", () => {
    expect(brandToColumn(DEFAULT_BRAND)).toEqual({});
    const b = parseBrand({ name: "Acme", logo: { mime: "image/png", ext: "png", version: 5 } });
    expect(brandToColumn(b)).toEqual({ name: "Acme", logo: { mime: "image/png", ext: "png", version: 5 } });
  });
});

describe("image checks", () => {
  it("accepts a square 512 png favicon", () => expect(checkFavicon(png(512, 512)).ok).toBe(true));
  it("rejects non-square, too small, too large", () => {
    expect(checkFavicon(png(512, 256))).toEqual({ ok: false, error: "err_not_square" });
    expect(checkFavicon(png(64, 64))).toEqual({ ok: false, error: "err_size_range" });
    expect(checkFavicon(png(2048, 2048))).toEqual({ ok: false, error: "err_size_range" });
  });
  it("rejects non-png favicons and SVG logos by content, not by name", () => {
    expect(checkFavicon(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).ok).toBe(false);
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    expect(checkLogo(svg)).toEqual({ ok: false, error: "err_file_type" });
  });
  it("rejects empty and oversized files", () => {
    expect(checkLogo(new Uint8Array())).toEqual({ ok: false, error: "err_file_missing" });
    expect(checkLogo(png(10, 10, 1024 * 1024)).ok).toBe(false);
    expect(checkFavicon(png(512, 512, 600 * 1024))).toEqual({ ok: false, error: "err_file_big" });
  });
});
