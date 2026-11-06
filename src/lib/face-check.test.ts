import { describe, expect, it } from "vitest";
import { judgeFace } from "@/lib/face-check";

const img = { width: 600, height: 800 };
const face = (o: Partial<{ x: number; y: number; w: number; h: number; angle: number; noseShift: number }> = {}) => {
  const w = o.w ?? 260, h = o.h ?? 340, x = o.x ?? 170, y = o.y ?? 150, a = ((o.angle ?? 0) * Math.PI) / 180;
  const cx = x + w / 2, ey = y + h * 0.38, half = w * 0.25;
  return { box: { x, y, width: w, height: h }, leftEye: { x: cx - half * Math.cos(a), y: ey - half * Math.sin(a) }, rightEye: { x: cx + half * Math.cos(a), y: ey + half * Math.sin(a) }, nose: { x: cx + (o.noseShift ?? 0) * half * 2, y: ey + h * 0.2 } };
};
describe("face advice", () => {
  it("a centred, upright, front-facing face of good size has nothing to say", () => expect(judgeFace(img, [face()])).toEqual([]));
  it("no face / several faces", () => { expect(judgeFace(img, [])).toEqual(["none"]); expect(judgeFace(img, [face(), face({ x: 10 })])).toEqual(["many"]); });
  it("too small, too big, off to the side", () => {
    expect(judgeFace(img, [face({ w: 100, h: 120 })])).toContain("small"); expect(judgeFace(img, [face({ w: 500, h: 720, x: 50, y: 40 })])).toContain("big");
    expect(judgeFace(img, [face({ x: 380 })])).toContain("off");
  });
  it("tilted head and turned face", () => { expect(judgeFace(img, [face({ angle: 20 })])).toContain("tilt"); expect(judgeFace(img, [face({ noseShift: 0.4 })])).toContain("turned"); });
});
