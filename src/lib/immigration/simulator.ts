import "server-only";
import { randomBytes } from "node:crypto";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { ImmigrationError, type ImmigrationGateway } from "./gateway";
import type { Docket, DocketResult, MasterItem } from "./schema";

/**
 * Immigration inside ThaiPass, for trying the whole journey before the real API exists. It answers like the real one (a reference number for every docket,
 * an E-VOA file on approval) but decides nothing by itself: staff press "Approve / Reject / Need update" on the application, which goes through exactly the same
 * code as a real callback. Every reference it hands out starts with SIM- and every file says it is a simulation, so a simulated result can never be mistaken for a real one.
 */
export const SIM_PREFIX = "SIM-";
export const isSimulatedRef = (ref: string | null | undefined) => !!ref && ref.startsWith(SIM_PREFIX);

export async function simulatedEvoaPdf(ref: string): Promise<Buffer> {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([595, 842]); const bold = await pdf.embedFont(StandardFonts.HelveticaBold), reg = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("SIMULATION", { x: 90, y: 560, size: 80, font: bold, color: rgb(0.85, 0.2, 0.2), rotate: { type: "degrees" as never, angle: 25 } });
  page.drawText("E-VOA (test file, not issued by Thai Immigration)", { x: 50, y: 770, size: 16, font: bold });
  page.drawText(`Reference ${ref}`, { x: 50, y: 740, size: 12, font: reg });
  page.drawText("This file was made by the built-in Immigration simulator of ThaiPass e-VOA. It has no legal value.", { x: 50, y: 715, size: 10, font: reg, color: rgb(0.4, 0.4, 0.4) });
  return Buffer.from(await pdf.save());
}

export class SimulatedGateway implements ImmigrationGateway {
  /** The reference lists come from the real API (or the sample lists); the simulator has none of its own. */
  async master(): Promise<MasterItem[]> { throw new ImmigrationError("unavailable", "The built-in simulator has no reference lists"); }
  async submitDocket(docket: Docket): Promise<DocketResult> {
    const ok = docket.Applicants.map((a) => ({ paymentReceiptRefNumber: a.applicantDetails.paymentReceiptRefNumber, webReferenceNumber: `${SIM_PREFIX}${randomBytes(4).toString("hex").toUpperCase()}` }));
    return { isSuccess: true, totalSuccessCount: ok.length, totalFailedCount: 0, successList: ok, failedList: [] };
  }
  async status(): Promise<string | null> { return null; }                                        // a decision only comes from the buttons
  async evoa(webReferenceNumber: string): Promise<Buffer | null> { return isSimulatedRef(webReferenceNumber) ? simulatedEvoaPdf(webReferenceNumber) : null; }
  async uploadAdditionalDocuments(): Promise<void> { /* accepted */ }
}
