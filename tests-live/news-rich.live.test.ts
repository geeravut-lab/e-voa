// Live checks of news pictures against the real Storage: type and size checks, resizing, serving through /news-img, and clean-up when nothing uses a picture any more.
// Only files this test created are removed. The real news rows are never touched.
import { afterAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { saveNewsImage, readNewsImage, removeUnusedNewsImages, MAX_NEWS_IMAGE_BYTES, NEWS_IMAGE_MAX_SIDE } from "@/lib/content/news-images";
import { NEWS_IMG_RE } from "@/lib/content/rich";
import { admin } from "./helpers";

const made: string[] = [];
afterAll(async () => { if (made.length) await admin.storage.from("brand-assets").remove(made.map((n) => `news/${n}`)); });
const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 20, g: 120, b: 200 } } }).png().toBuffer();

describe("live news pictures", () => {
  it("shrinks a big picture, re-encodes it as WebP and serves exactly those bytes", async () => {
    const r = await saveNewsImage(new Uint8Array(await png(3200, 2000)));
    expect(r.ok).toBe(true); if (!r.ok) return; made.push(r.name);
    expect(NEWS_IMG_RE.test(r.name)).toBe(true); expect(r.url).toBe(`/news-img/${r.name}`);
    const f = await readNewsImage(r.name); expect(f?.mime).toBe("image/webp");
    const meta = await sharp(Buffer.from(f!.bytes)).metadata();
    expect(meta.format).toBe("webp"); expect(Math.max(meta.width!, meta.height!)).toBe(NEWS_IMAGE_MAX_SIDE); expect(meta.width! / meta.height!).toBeCloseTo(1.6, 1);
  });
  it("does not enlarge a small picture", async () => {
    const r = await saveNewsImage(new Uint8Array(await png(300, 200))); expect(r.ok).toBe(true); if (!r.ok) return; made.push(r.name);
    const meta = await sharp(Buffer.from((await readNewsImage(r.name))!.bytes)).metadata(); expect([meta.width, meta.height]).toEqual([300, 200]);
  });
  it("removes camera data (the GPS position) from a photo", async () => {
    const withGps = await sharp(await png(400, 300)).withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "13/1 45/1 0/1" } }).jpeg().toBuffer();
    const r = await saveNewsImage(new Uint8Array(withGps)); expect(r.ok).toBe(true); if (!r.ok) return; made.push(r.name);
    const meta = await sharp(Buffer.from((await readNewsImage(r.name))!.bytes)).metadata(); expect(meta.exif).toBeUndefined();
  });
  it("refuses an SVG, a web page, a damaged picture, an empty file and a file that is too big", async () => {
    const enc = (s: string) => new Uint8Array(Buffer.from(s));
    expect(await saveNewsImage(enc('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'))).toEqual({ ok: false, error: "err_file_type" });
    expect(await saveNewsImage(enc("<html><script>alert(1)</script></html>"))).toEqual({ ok: false, error: "err_file_type" });
    const bad = new Uint8Array(await png(100, 100)); bad.fill(0, 60);              // starts like a PNG but is damaged
    expect(await saveNewsImage(bad)).toEqual({ ok: false, error: "err_file_type" });
    expect(await saveNewsImage(new Uint8Array(0))).toEqual({ ok: false, error: "err_file_missing" });
    expect(await saveNewsImage(new Uint8Array(MAX_NEWS_IMAGE_BYTES + 1))).toEqual({ ok: false, error: "err_file_big" });
  });
  it("never reads a name that is not one of ours (no path tricks)", async () => {
    for (const bad of ["../brand-assets/logo.png", "news/../x.webp", "0123456789abcdef01234567.svg", "short.webp", "0123456789ABCDEF01234567.webp"]) expect(await readNewsImage(bad), bad).toBeNull();
  });
  it("removes a picture only when no content item uses it", async () => {
    const r = await saveNewsImage(new Uint8Array(await png(200, 200))); expect(r.ok).toBe(true); if (!r.ok) return; made.push(r.name);
    const row = (await admin.from("content_items").insert({ kind: "news", title: { en: "NR use" }, body: { en: `![x](/news-img/${r.name})` }, published: false }).select("id").single()).data!;
    try {
      expect(await removeUnusedNewsImages([r.name])).toBe(0);                          // still used
      expect((await admin.storage.from("brand-assets").list("news", { search: r.name })).data?.length).toBe(1);          // (listed, not downloaded: a download can be cached for a while)
    } finally { await admin.from("content_items").delete().eq("id", row.id); }
    expect(await removeUnusedNewsImages([r.name])).toBe(1);                              // nobody uses it now
    expect((await admin.storage.from("brand-assets").list("news", { search: r.name })).data?.length).toBe(0);
    expect(await readNewsImage(r.name)).toBeNull();
  });
});
