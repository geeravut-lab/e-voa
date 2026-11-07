// The E-VOA pass as one self-contained SVG picture (the phone turns it into a PNG). PURE: the route and the tests share it.
const esc = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Places the QR code (its own SVG from the QR library) inside the card. The library's root already has width and height, so they are REPLACED:
 * an attribute written twice makes the whole file invalid XML and no viewer can open it.
 */
export function embedQr(qrSvg: string, x: number, y: number, size: number): string {
  const body = qrSvg.replace(/^<\?xml[^>]*>/, "").trim();
  const viewBox = /<svg[^>]*\sviewBox="([^"]+)"/.exec(body)?.[1];
  const inner = body.replace(/^<svg[^>]*>/, "");
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}"${viewBox ? ` viewBox="${viewBox}"` : ""} shape-rendering="crispEdges">${inner}`;
}

export function passCardSvg(p: { name: string; ref: string; arrival: string; flight: string; govRef: string; qrSvg: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560" font-family="system-ui, sans-serif"><rect width="400" height="560" rx="24" fill="white" stroke="rgb(21,87,224)" stroke-width="4"/>
<text x="200" y="50" text-anchor="middle" font-size="14" font-weight="800" letter-spacing="3" fill="rgb(21,87,224)">E-VOA PASS</text>
<text x="200" y="100" text-anchor="middle" font-size="22" font-weight="800" fill="rgb(17,17,17)">${esc(p.name).slice(0, 40)}</text>
<rect x="60" y="140" width="280" height="280" rx="12" fill="white" stroke="rgb(221,227,238)"/>${embedQr(p.qrSvg, 70, 150, 260)}
<text x="200" y="460" text-anchor="middle" font-size="18" font-family="monospace" font-weight="700" fill="rgb(17,17,17)">${esc(p.ref)}</text>
<text x="200" y="490" text-anchor="middle" font-size="14" fill="rgb(68,68,68)">${esc(p.arrival)} ${esc(p.flight)}</text>
<text x="200" y="520" text-anchor="middle" font-size="12" font-family="monospace" fill="rgb(68,68,68)">${esc(p.govRef)}</text></svg>`;
}
