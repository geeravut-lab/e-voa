import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { embedQr, passCardSvg } from "@/lib/pass-card";

/** Every start tag may name an attribute only once (a repeated one makes the file invalid XML and no viewer opens it), and tags must nest and close. */
function wellFormed(xml: string): string | null {
  const stack: string[] = [];
  for (const m of xml.matchAll(/<(\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, close, name, attrs, self] = m;
    if (close) { if (stack.pop() !== name) return `closing </${name}> does not match`; continue; }
    const names = [...attrs.matchAll(/\s([\w:-]+)="[^"]*"/g)].map((a) => a[1]);
    const dup = names.find((n, i) => names.indexOf(n) !== i); if (dup) return `<${name}> repeats attribute ${dup}`;
    if (!self) stack.push(name);
  }
  return stack.length ? `unclosed <${stack.pop()}>` : null;
}
describe("the pass card picture", () => {
  it("is well-formed XML with the real QR code (this was broken: width and height were written twice)", async () => {
    const qr = await QRCode.toString("https://e-voa.vercel.app/v/abc", { type: "svg", margin: 0, width: 260, errorCorrectionLevel: "M" });
    expect(wellFormed(qr)).toBeNull();
    const svg = passCardSvg({ name: "Anna <K> & Co", ref: "VOA-123", arrival: "2026-12-01", flight: "TG921", govRef: "GOV-9", qrSvg: qr });
    expect(wellFormed(svg)).toBeNull(); expect(svg.match(/<svg /g)).toHaveLength(2);
    expect(svg).toContain('<svg x="70" y="150" width="260" height="260" viewBox="0 0 29 29"'); expect(svg).not.toMatch(/<svg[^>]*width="260"[^>]*width=/);
    expect(svg).toContain("Anna &#60;K&#62; &#38; Co"); expect(svg).not.toContain("<K>");
  });
  it("keeps what the QR library draws and scales it into the card", () => {
    const e = embedQr('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 5 5"><path d="M0 0h5v5H0z"/></svg>', 1, 2, 100);
    expect(e).toBe('<svg x="1" y="2" width="100" height="100" viewBox="0 0 5 5" shape-rendering="crispEdges"><path d="M0 0h5v5H0z"/></svg>');
  });
});
