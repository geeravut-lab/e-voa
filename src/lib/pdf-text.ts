import "server-only";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "node:fs";
import path from "node:path";

// Thai and Latin letters come from two files of the same family (Noto Sans Thai), so text is drawn in runs: Thai runs with the Thai file, everything else with the Latin file.
const dir = () => path.join(process.cwd(), "node_modules", "@fontsource", "noto-sans-thai", "files");
export type Fonts = { thai: PDFFont; latin: PDFFont; thaiBold: PDFFont; latinBold: PDFFont };

export async function embedFonts(pdf: PDFDocument): Promise<Fonts> {
  pdf.registerFontkit(fontkit);
  const f = (n: string) => pdf.embedFont(readFileSync(path.join(dir(), n)), { subset: true });
  const [thai, latin, thaiBold, latinBold] = await Promise.all([f("noto-sans-thai-thai-400-normal.woff"), f("noto-sans-thai-latin-400-normal.woff"), f("noto-sans-thai-thai-700-normal.woff"), f("noto-sans-thai-latin-700-normal.woff")]);
  return { thai, latin, thaiBold, latinBold };
}

export const runsOf = (text: string): { thai: boolean; text: string }[] => {
  const out: { thai: boolean; text: string }[] = [];
  for (const ch of text) { const thai = /[฀-๿]/.test(ch); const last = out[out.length - 1]; if (last && last.thai === thai) last.text += ch; else out.push({ thai, text: ch }); }
  return out;
};
export function widthOf(fonts: Fonts, text: string, size: number, bold = false) {
  return runsOf(text).reduce((w, r) => w + (r.thai ? (bold ? fonts.thaiBold : fonts.thai) : bold ? fonts.latinBold : fonts.latin).widthOfTextAtSize(r.text, size), 0);
}
/** Draws mixed Thai/Latin text; returns the width used. Characters the font does not have (for example Chinese) are replaced by "?" so the PDF never fails. */
export function drawMixed(page: PDFPage, fonts: Fonts, text: string, o: { x: number; y: number; size?: number; bold?: boolean; right?: boolean; color?: ReturnType<typeof rgb> }): number {
  const size = o.size ?? 10, safe = text.replace(/[^ -~ -ÿ฀-๿–—•·]/g, "?");
  const total = widthOf(fonts, safe, size, o.bold); let x = o.right ? o.x - total : o.x;
  for (const r of runsOf(safe)) {
    const font = r.thai ? (o.bold ? fonts.thaiBold : fonts.thai) : o.bold ? fonts.latinBold : fonts.latin;
    page.drawText(r.text, { x, y: o.y, size, font, color: o.color ?? rgb(0.08, 0.12, 0.2) }); x += font.widthOfTextAtSize(r.text, size);
  }
  return total;
}
