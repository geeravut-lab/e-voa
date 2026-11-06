import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ReceiptData = { brand: string; receiptNo: string; paidAt: string | null; lines: { label: string; amountThb: number }[]; totalThb: number; refunds: { label: string; amountThb: number }[]; note: string };

/** The standard PDF fonts only know Latin letters: accents are folded and anything else becomes "?" (passport names are Latin by definition). */
export const latin = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "?");
const money = (n: number) => `THB ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function buildReceiptPdf(d: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);                                             // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold), mono = await pdf.embedFont(StandardFonts.Courier);
  const ink = rgb(0.08, 0.12, 0.2), grey = rgb(0.4, 0.43, 0.5), blue = rgb(0.08, 0.34, 0.88);
  let y = 780;
  const text = (s: string, x: number, size = 11, f = font, color = ink) => page.drawText(latin(s), { x, y, size, font: f, color });
  const right = (s: string, xr: number, size = 11, f = font) => { const t = latin(s); page.drawText(t, { x: xr - f.widthOfTextAtSize(t, size), y, size, font: f, color: ink }); };
  text(d.brand, 50, 20, bold, blue); y -= 30;
  text("RECEIPT", 50, 12, bold, grey); text(d.receiptNo, 140, 12, mono); y -= 18;
  if (d.paidAt) { text(`Paid: ${d.paidAt.slice(0, 16).replace("T", " ")} UTC`, 50, 10, font, grey); y -= 14; }
  y -= 14; page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.8, color: grey }); y -= 20;
  for (const l of d.lines) { text(l.label.slice(0, 70), 50); right(money(l.amountThb), 545); y -= 18; }
  y -= 4; page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.8, color: grey }); y -= 20;
  text("Total", 50, 12, bold); right(money(d.totalThb), 545, 12, bold); y -= 22;
  for (const r of d.refunds) { text(`Refund: ${r.label}`.slice(0, 70), 50, 10, font, grey); right(`- ${money(r.amountThb)}`, 545, 10); y -= 16; }
  y -= 20; const words = latin(d.note).split(" "); let line = "";
  for (const w of words) { if (font.widthOfTextAtSize(`${line} ${w}`, 9) > 495) { text(line, 50, 9, font, grey); y -= 13; line = w; } else line = line ? `${line} ${w}` : w; }
  if (line) text(line, 50, 9, font, grey);
  return pdf.save();
}
