import "server-only";
import { PDFDocument, rgb } from "pdf-lib";
import { drawMixed, embedFonts } from "@/lib/pdf-text";
import type { Company } from "@/lib/invoice";
import type { Statement } from "./statement";

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Thai + English commission statement for one agency and month (A4). `paidAt` is set once staff have paid the commission out. */
export async function buildStatementPdf(s: Statement, seller: Company, paidAt: string | null): Promise<Uint8Array> {
  const pdf = await PDFDocument.create(); const fonts = await embedFonts(pdf);
  const grey = rgb(0.4, 0.43, 0.5), blue = rgb(0.08, 0.34, 0.88), green = rgb(0.05, 0.48, 0.31);
  let page = pdf.addPage([595, 842]); let y = 790;
  const txt = (t: string, x: number, o: { size?: number; bold?: boolean; right?: boolean; color?: ReturnType<typeof rgb> } = {}) => drawMixed(page, fonts, t, { x, y, ...o });
  txt("ใบสรุปค่าคอมมิชชัน / Commission statement", 40, { size: 17, bold: true, color: blue }); y -= 24;
  txt(s.statementNo, 40, { size: 11, bold: true }); txt(s.period, 555, { right: true, size: 10, color: grey }); y -= 20;
  txt(seller.legal_name_th || seller.legal_name || "ThaiPass e-VOA", 40, { bold: true, size: 11 }); y -= 14;
  for (const a of [seller.address_th, seller.address].filter(Boolean)) { txt(a.slice(0, 110), 40, { size: 9, color: grey }); y -= 12; }
  if (seller.tax_id) { txt(`เลขประจำตัวผู้เสียภาษี / Tax ID: ${seller.tax_id}`, 40, { size: 9, color: grey }); y -= 12; }
  y -= 8; txt("เอเจนซี่ / Agency", 40, { bold: true, size: 10, color: grey }); y -= 14; txt(s.agencyName, 40, { size: 12, bold: true }); y -= 14;
  txt(`อัตราคอมมิชชัน / Commission rate: ${s.commissionPct}%  ·  คิดจากค่าบริการเท่านั้น ไม่รวมค่าธรรมเนียมวีซ่า / on service fees only, never on the visa fee`, 40, { size: 8.5, color: grey }); y -= 18;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.8, color: grey }); y -= 14;
  const head = () => { txt("วันที่ / Date", 40, { bold: true, size: 9 }); txt("อ้างอิง / Reference", 100, { bold: true, size: 9 }); txt("ผู้เดินทาง / Traveler", 205, { bold: true, size: 9 }); txt("ค่าบริการ / Fee", 440, { bold: true, size: 9, right: true }); txt("คอมมิชชัน / Comm.", 555, { bold: true, size: 9, right: true }); y -= 14; };
  head();
  for (const l of s.lines) {
    if (y < 140) { page = pdf.addPage([595, 842]); y = 790; head(); }
    txt(l.date, 40, { size: 9 }); txt(l.reference, 100, { size: 9 }); txt(l.traveler.slice(0, 34), 205, { size: 9 }); txt(money(l.serviceFeeThb), 440, { right: true, size: 9 }); txt(money(l.commissionThb), 555, { right: true, size: 9 }); y -= 13;
  }
  y -= 4; page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.8, color: grey }); y -= 18;
  txt(`จำนวนใบสมัคร / Applications: ${s.applications}`, 40, { size: 10 }); txt("รวมค่าบริการ / Service fees", 440, { right: true, size: 10 }); txt(money(s.serviceFeesThb), 555, { right: true, size: 10 }); y -= 16;
  txt("คอมมิชชันที่ต้องจ่าย / Commission due THB", 440, { right: true, size: 11, bold: true }); txt(money(s.commissionThb), 555, { right: true, size: 11, bold: true }); y -= 24;
  if (paidAt) txt(`จ่ายแล้วเมื่อ / Paid on ${paidAt.slice(0, 10)}`, 40, { size: 10, bold: true, color: green });
  else txt("ยังไม่ได้จ่าย / Not paid yet", 40, { size: 10, color: grey });
  y -= 22; txt("เอกสารนี้สรุปคอมมิชชันตามข้อตกลงกับเอเจนซี่ ไม่ใช่ใบกำกับภาษี / This statement summarises the agreed commission; it is not a tax invoice.", 40, { size: 8, color: grey });
  return pdf.save();
}
