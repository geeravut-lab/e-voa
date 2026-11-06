import "server-only";
import { PDFDocument, rgb } from "pdf-lib";
import { drawMixed, embedFonts } from "@/lib/pdf-text";
import type { InvoiceData } from "@/lib/invoice";

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Thai + English tax invoice (or plain receipt when the seller is not VAT registered). A4, one page per 18 lines. */
export async function buildInvoicePdf(d: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create(); const fonts = await embedFonts(pdf);
  const grey = rgb(0.4, 0.43, 0.5), blue = rgb(0.08, 0.34, 0.88);
  let page = pdf.addPage([595, 842]); let y = 790;
  const txt = (s: string, x: number, o: { size?: number; bold?: boolean; right?: boolean; color?: ReturnType<typeof rgb> } = {}) => drawMixed(page, fonts, s, { x, y, ...o });
  const title = d.vatRegistered ? "ใบกำกับภาษี / Tax Invoice" : "ใบเสร็จรับเงิน / Receipt";
  txt(title, 40, { size: 18, bold: true, color: blue }); y -= 24;
  txt(`${d.invoiceNo}`, 40, { size: 11, bold: true }); txt(d.issuedAt.slice(0, 10), 555, { right: true, size: 10, color: grey }); y -= 22;
  // seller
  txt(d.seller.legal_name_th || d.seller.legal_name, 40, { bold: true, size: 11 }); y -= 14;
  if (d.seller.legal_name && d.seller.legal_name_th) { txt(d.seller.legal_name, 40, { size: 10 }); y -= 13; }
  for (const a of [d.seller.address_th, d.seller.address].filter(Boolean)) { txt(a.slice(0, 110), 40, { size: 9, color: grey }); y -= 12; }
  txt(`เลขประจำตัวผู้เสียภาษี / Tax ID: ${d.seller.tax_id}   สาขา / Branch: ${d.seller.branch === "00000" ? "สำนักงานใหญ่ / Head office" : d.seller.branch}`, 40, { size: 9 }); y -= 22;
  // buyer
  txt("ผู้ซื้อ / Customer", 40, { bold: true, size: 10, color: grey }); y -= 14;
  txt(d.buyer.name, 40, { size: 11, bold: true }); y -= 13;
  if (d.buyer.address) { txt(d.buyer.address.slice(0, 110), 40, { size: 9, color: grey }); y -= 12; }
  if (d.buyer.tax_id) { txt(`เลขประจำตัวผู้เสียภาษี / Tax ID: ${d.buyer.tax_id}${d.buyer.branch ? `   สาขา / Branch: ${d.buyer.branch}` : ""}`, 40, { size: 9 }); y -= 12; }
  if (d.receiptNo) { txt(`ใบเสร็จเลขที่ / Receipt no.: ${d.receiptNo}`, 40, { size: 9, color: grey }); y -= 12; }
  y -= 14; page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.8, color: grey }); y -= 14;
  txt("รายการ / Description", 40, { bold: true, size: 9 }); txt("ก่อน VAT / Net", 400, { bold: true, size: 9, right: true }); txt("VAT", 475, { bold: true, size: 9, right: true }); txt("รวม / Total", 555, { bold: true, size: 9, right: true }); y -= 16;
  for (const l of d.lines) {
    if (y < 140) { page = pdf.addPage([595, 842]); y = 790; }
    txt(l.label.slice(0, 62), 40, { size: 9.5 }); txt(money(l.netThb), 400, { right: true, size: 9.5 }); txt(l.vat === "none" ? "—" : money(l.vatThb), 475, { right: true, size: 9.5 }); txt(money(l.amountThb), 555, { right: true, size: 9.5 }); y -= 15;
    if (l.vat === "none" && d.vatRegistered) { txt("ไม่อยู่ในบังคับภาษีมูลค่าเพิ่ม (เรียกเก็บแทนหน่วยงานรัฐ) / Not subject to VAT (collected on behalf of the government)", 40, { size: 7.5, color: grey }); y -= 11; }
  }
  y -= 4; page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.8, color: grey }); y -= 18;
  txt("มูลค่าก่อน VAT / Net", 400, { right: true, size: 10 }); txt(money(d.netThb), 555, { right: true, size: 10 }); y -= 15;
  if (d.vatRegistered) { txt(`ภาษีมูลค่าเพิ่ม ${d.vatRate}% / VAT ${d.vatRate}%`, 400, { right: true, size: 10 }); txt(money(d.vatThb), 555, { right: true, size: 10 }); y -= 15; }
  txt("รวมทั้งสิ้น / Total THB", 400, { right: true, size: 11, bold: true }); txt(money(d.totalThb), 555, { right: true, size: 11, bold: true }); y -= 30;
  txt("ชำระแล้วทางบัตร / Paid by card. เอกสารนี้ไม่ใช่วีซ่า ผลการพิจารณาวีซ่าเป็นของสำนักงานตรวจคนเข้าเมือง / This document is not a visa; the decision is made by Thai Immigration.", 40, { size: 7.5, color: grey });
  return pdf.save();
}
