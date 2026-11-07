#!/usr/bin/env node
// ThaiPass e-VOA partner simulator.
// One small Node server (no dependencies) that behaves like the outside systems ThaiPass talks to:
//   /immigration/th/v1/...   Immigration Bureau (same API and parameters as the former intermediary's ICD v1.2.5)
//   /insurance/CIS/...       travel insurance
//   /sim/...                 SIM and eSIM
//   /vip/...                 VIP services
//   /bhs/...                 Beauty & Health services
// Flows and field names come from "TieThai & WeGoThiland Documents/Flow & API Docs" (see docs/evoa/06-MOCK-PARTNERS.md).
//
// Run:  npm run mock          (port 4010)         Test:  npm test
//
// Choosing the outcome of an Immigration application (by the END of the passport number):
//   …APR (or anything else)  approved after MOCK_DECISION_DELAY_MS (default 2000)
//   …REJ                      rejected ("blacklist match", simulated)
//   …UPD                      "need update" first; after uploadAdditionalDocuments it is approved
//   …SLOW                     no decision until POST /__admin/decide
//   …DOWN                     the docket call answers 503 (gateway down)
//   …ERR                      the docket call answers 500 once, then works (retry test)
//   …BAD                      the docket is refused with a failedList entry
import { createServer } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { MASTERS, districtsOf, subDistrictsOf, SIM_PACKAGES, VIP_PACKAGES, BHS_PACKAGES, INSURANCE_PLANS } from "./master-data.mjs";

/** Partner request signature used by the simulator: X-API-KEY = HMAC-SHA256(secret, timestamp) in hex.
 *  The original documents describe this with a picture we cannot read, so the exact algorithm must be confirmed with each partner. */
export const signPartner = (secret, timestamp) => createHmac("sha256", secret).update(String(timestamp)).digest("hex");

const SAMPLE_PDF = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\n% SIMULATED E-VOA - NOT A REAL DOCUMENT\ntrailer<</Root 1 0 R>>\n%%EOF";
const b64 = (s) => Buffer.from(s).toString("base64");
const eq = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DOCKET_APPLICANT_REQUIRED = {
  applicantDetails: ["paymentReceiptRefNumber", "ApplicantName", "Email", "Mobile", "IsPriority", "ISDCode", "NationalityId"],
  passportDetails: ["GivenName", "SurName", "PassportNumber", "PassportExpiryDate", "PassportIssueDate", "DateOfBirth", "ResidencyId", "GenderId", "SalutationId", "PassportTypeId", "PermanentAddress", "State", "YearlyIncome", "PlaceOfIssue", "OccupationId"],
  travelDetails: ["ArrivalAirportId", "ArrivalDate", "ArrivalTime", "ArrivalFlightNumber", "ArrivalAirlinesId", "DepartureDate", "DepartureTime", "DepartureFlightNumber", "DepartureAirlinesId", "PurposeOfVisit", "BoardedCountry", "NextCity", "FirstTimeTraveller", "TypeOfFlight", "LengthOfStay"],
  accommodationDetails: ["PlaceOfStayId", "AccommodationOrOwnerName", "CityId", "DistrictId", "SubDistrictId", "PinCode", "StreetAddress", "ReferenceDetails"],
};
const MAX_LEN = { ApplicantName: 100, Email: 80, Mobile: 12, ISDCode: 9, GivenName: 255, SurName: 255, PassportNumber: 15, PermanentAddress: 100, State: 100, PlaceOfIssue: 50, ArrivalFlightNumber: 50, DepartureFlightNumber: 50, NextCity: 128, LengthOfStay: 2, AccommodationOrOwnerName: 50, PinCode: 10, StreetAddress: 100, ReferenceDetails: 50 };
const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^\d{2}:\d{2}$/;
const DATE_FIELDS = ["PassportExpiryDate", "PassportIssueDate", "DateOfBirth", "ArrivalDate", "DepartureDate"];
const TIME_FIELDS = ["ArrivalTime", "DepartureTime"];

/** Validates one applicant the way the ICD describes. Returns an error string or null. */
export function validateApplicant(a) {
  if (!a || typeof a !== "object") return "applicant missing";
  for (const [group, fields] of Object.entries(DOCKET_APPLICANT_REQUIRED)) {
    const g = a[group];
    if (!g || typeof g !== "object") return `${group} missing`;
    for (const f of fields) if (g[f] === undefined || g[f] === null || g[f] === "") return `${group}.${f} is required`;
    for (const f of fields) if (MAX_LEN[f] && String(g[f]).length > MAX_LEN[f]) return `${group}.${f} is longer than ${MAX_LEN[f]}`;
    for (const f of DATE_FIELDS) if (g[f] !== undefined && !DATE.test(g[f])) return `${group}.${f} must be YYYY-MM-DD`;
    for (const f of TIME_FIELDS) if (g[f] !== undefined && !TIME.test(g[f])) return `${group}.${f} must be HH:MM`;
  }
  if (![0, 1].includes(a.applicantDetails.IsPriority)) return "applicantDetails.IsPriority must be 0 or 1";
  const docs = a.documentList;
  if (!Array.isArray(docs) || docs.length < 6 || docs.length > 8) return "documentList must contain 6 to 8 documents";
  const byId = new Map(MASTERS.documentList.map((d) => [d.Id, d]));
  for (const d of docs) {
    if (!byId.has(d.DocumentListId)) return `unknown DocumentListId ${d.DocumentListId}`;
    if (!["image/jpeg", "application/pdf"].includes(d.MimeType)) return `document ${d.DocumentListId}: MimeType must be image/jpeg or application/pdf`;
    if (!d.FileContent || !d.FileName) return `document ${d.DocumentListId}: FileContent and FileName are required`;
    const kb = Math.ceil(Buffer.byteLength(d.FileContent, "base64") / 1024);
    if (kb > byId.get(d.DocumentListId).MaxKb) return `document ${d.DocumentListId}: ${kb} KB is over the ${byId.get(d.DocumentListId).MaxKb} KB limit`;
  }
  return null;
}

export function createMockServer(opts = {}) {
  const cfg = {
    decisionDelayMs: Number(opts.decisionDelayMs ?? process.env.MOCK_DECISION_DELAY_MS ?? 2000),
    immigrationToken: opts.immigrationToken ?? process.env.MOCK_IMMIGRATION_TOKEN ?? "",           // empty = any non-empty Authorization is accepted
    immigrationFrom: opts.immigrationFrom ?? process.env.MOCK_IMMIGRATION_FROM ?? "",
    partnerSecret: opts.partnerSecret ?? process.env.MOCK_PARTNER_SECRET ?? "mock-secret",
    partnerPublicKey: opts.partnerPublicKey ?? process.env.MOCK_PARTNER_PUBLIC_KEY ?? "mock-public",
    partnerAuth: (opts.partnerAuth ?? process.env.MOCK_PARTNER_AUTH ?? "on") !== "off",
    callbackSecret: opts.callbackSecret ?? process.env.MOCK_CALLBACK_SECRET ?? "mock-callback-secret",
    duplicateMode: opts.duplicateMode ?? process.env.MOCK_DUPLICATE_MODE ?? "idempotent",            // idempotent | reject
    callbacks: {
      immigration: opts.callbacks?.immigration ?? process.env.MOCK_CALLBACK_IMMIGRATION ?? "",
      insurance: opts.callbacks?.insurance ?? process.env.MOCK_CALLBACK_INSURANCE ?? "",
      sim: opts.callbacks?.sim ?? process.env.MOCK_CALLBACK_SIM ?? "",
      vip: opts.callbacks?.vip ?? process.env.MOCK_CALLBACK_VIP ?? "",
      bhs: opts.callbacks?.bhs ?? process.env.MOCK_CALLBACK_BHS ?? "",
    },
    log: opts.log ?? (process.env.MOCK_QUIET === "1" ? () => {} : (m) => console.log(`[mock] ${m}`)),
  };
  const state = { applications: new Map(), byPayment: new Map(), insurance: new Map(), sim: new Map(), vip: new Map(), bhs: new Map(), callbacksSent: [], aiRequests: [], aiBreak: {}, walletPatches: [], messagesSent: [], seq: 0, errOnce: new Set() };
  const timers = new Set();

  const send = (res, code, body, headers = {}) => { const s = JSON.stringify(body); res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(s), ...headers }); res.end(s); };
  const readRaw = (req) => new Promise((resolve) => { const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8"))); });
  const readBody = (req) => new Promise((resolve) => { const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", () => { const raw = Buffer.concat(chunks).toString("utf8"); if (!raw) return resolve({}); const ct = req.headers["content-type"] ?? ""; try { resolve(ct.includes("x-www-form-urlencoded") ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw)); } catch { resolve({ __invalid: true }); } }); });

  async function callback(kind, path, body, method = "POST") {
    const base = cfg.callbacks[kind]; if (!base) { state.callbacksSent.push({ kind, path, body, delivered: false, reason: "no callback url" }); return; }
    const url = base.replace(/\/$/, "") + (path ?? "");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.callbackSecret}` }, body: JSON.stringify(body) });
      state.callbacksSent.push({ kind, path, body, delivered: res.ok, status: res.status }); cfg.log(`callback ${kind} ${path ?? ""} -> ${res.status}`);
    } catch (e) { state.callbacksSent.push({ kind, path, body, delivered: false, reason: String(e.message) }); cfg.log(`callback ${kind} failed: ${e.message}`); }
  }
  const later = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); t.unref?.(); timers.add(t); };

  // ------------------------------------------------------------------ Immigration
  const immAuth = (req, res) => {
    const token = req.headers["authorization"], from = req.headers["from"];
    if (!token || !from) { send(res, 401, { status: 401, message: "Not authorized" }); return false; }
    if (cfg.immigrationToken && !eq(String(token), cfg.immigrationToken)) { send(res, 401, { status: 401, message: "Not authorized" }); return false; }
    if (cfg.immigrationFrom && !eq(String(from), cfg.immigrationFrom)) { send(res, 401, { status: 401, message: "Not authorized" }); return false; }
    return true;
  };
  const tagOf = (pn) => { const u = String(pn ?? "").toUpperCase(); return ["SLOW", "DOWN", "APR", "REJ", "UPD", "ERR", "BAD"].find((t) => u.endsWith(t)) ?? ""; };
  const decide = (app, statusId, statusDesc) => {
    app.status = statusId === 1 ? "Approved" : statusId === 2 ? "Rejected" : "NeedUpdate"; app.statusDesc = statusDesc ?? "";
    if (statusId === 1) app.evoaContent = b64(SAMPLE_PDF);
    return callback("immigration", "", { batchReference: app.batchReference, webReferenceNumber: app.webReferenceNumber, statusId, statusDesc: statusDesc ?? null, evoaContent: statusId === 1 ? app.evoaContent : null });
  };
  const scheduleDecision = (app) => {
    const s = tagOf(app.passportNumber);
    if (s === "SLOW") return;
    later(cfg.decisionDelayMs, () => { app.status = "Pending"; if (s === "REJ") decide(app, 2, "Blacklist match (simulated)"); else if (s === "UPD") decide(app, 3, "Please upload accommodation picture with hotel name again."); else decide(app, 1); });
  };

  async function immigration(req, res, path, url) {
    if (!immAuth(req, res)) return;
    const sub = path.replace(/^\/immigration\/th\/v1\//, "");
    if (req.method === "GET" && sub.startsWith("master/")) {
      const [, name, id] = sub.split("/");
      let result;
      if (id !== undefined) result = name === "district" ? districtsOf(id) : name === "subDistrict" ? subDistrictsOf(id) : name === "nationality" ? MASTERS.nationality : undefined;
      else result = MASTERS[name];
      if (!result) return send(res, 404, { status: 404, message: "Incorrect Request" });
      return send(res, 200, { status: 200, message: "Success", result });
    }
    if (req.method === "POST" && sub === "application/docket") {
      const body = await readBody(req);
      if (body.__invalid) return send(res, 400, { status: 400, message: "Incorrect data format" });
      const apps = Array.isArray(body.Applicants) ? body.Applicants : [];
      if (!body.batchReference || !body.paymentBatchReference || !Number.isInteger(body.NoOfApplicants) || apps.length === 0 || body.NoOfApplicants !== apps.length || body.Amount === undefined)
        return send(res, 400, { status: 400, message: "Incorrect data format" });
      const first = apps[0]?.passportDetails?.PassportNumber ?? "";
      if (tagOf(first) === "DOWN") return send(res, 503, { status: 503, message: "Service unavailable" });
      if (tagOf(first) === "ERR" && !state.errOnce.has(body.batchReference)) { state.errOnce.add(body.batchReference); return send(res, 500, { status: 500, message: "Internal Server Error" }); }
      const successList = [], failedList = [];
      for (const a of apps) {
        const pay = a?.applicantDetails?.paymentReceiptRefNumber ?? "";
        const err = validateApplicant(a) ?? (tagOf(a?.passportDetails?.PassportNumber) === "BAD" ? "Passport rejected by pre-validation (simulated)" : null);
        if (err) { failedList.push({ paymentReceiptRefNumber: pay, Reason: err.slice(0, 100) }); continue; }
        const dup = state.byPayment.get(pay);
        if (dup) { if (cfg.duplicateMode === "reject") failedList.push({ paymentReceiptRefNumber: pay, Reason: "Duplicate paymentReceiptRefNumber" }); else successList.push({ paymentReceiptRefNumber: pay, webReferenceNumber: dup.webReferenceNumber }); continue; }
        const webReferenceNumber = `W${String(++state.seq).padStart(6, "0")}${Date.now().toString().slice(-8)}`.slice(0, 15);
        const app = { webReferenceNumber, paymentReceiptRefNumber: pay, batchReference: body.batchReference, passportNumber: a.passportDetails.PassportNumber, priority: a.applicantDetails.IsPriority, status: "Pending", statusDesc: "", receivedAt: new Date().toISOString(), documents: a.documentList.length, extraDocuments: 0 };
        state.applications.set(webReferenceNumber, app); state.byPayment.set(pay, app); successList.push({ paymentReceiptRefNumber: pay, webReferenceNumber }); scheduleDecision(app);
      }
      return send(res, 200, { status: 200, message: "Success", result: { isSuccess: failedList.length === 0 || successList.length > 0, errorDesc: failedList.length ? "Some applications failed" : "", totalSuccessCount: successList.length, totalFailedCount: failedList.length, successList, failedList } });
    }
    if (req.method === "GET" && (sub.startsWith("application/getStatusById") || sub.startsWith("application/getEVOAById"))) {
      const q = url.searchParams; const app = state.applications.get(q.get("webReferenceNumber") ?? "");
      if (!app || app.paymentReceiptRefNumber !== q.get("paymentReceiptRefNumber")) return send(res, 200, { status: 200, message: "Success", result: { isSuccess: false, errorDesc: "Application not found" } });
      if (sub.includes("getStatusById")) return send(res, 200, { status: 200, message: "Success", result: { isSuccess: true, errorDesc: "", webReferenceNumber: app.webReferenceNumber, paymentReceiptRefNumber: app.paymentReceiptRefNumber, Status: app.status } });
      if (app.status !== "Approved") return send(res, 200, { status: 200, message: "Success", result: { isSuccess: false, errorDesc: "E-VOA is not ready" } });
      return send(res, 200, { status: 200, message: "Success", result: { isSuccess: true, errorDesc: "", webReferenceNumber: app.webReferenceNumber, paymentReceiptRefNumber: app.paymentReceiptRefNumber, evoaContent: app.evoaContent } });
    }
    if (req.method === "POST" && sub === "application/uploadAdditionalDocuments") {
      const b = await readBody(req); const app = state.applications.get(b.webReferenceNumber ?? "");
      if (!b.batchReference || !b.paymentReceiptNumber || !Array.isArray(b.documentList)) return send(res, 400, { status: 400, message: "Incorrect data format" });
      if (!app) return send(res, 200, { status: 200, message: "Success", result: { isSuccess: false, errorDesc: "Application not found" } });
      if (b.documentList.length === 0 || b.documentList.length > 5) return send(res, 200, { status: 200, message: "Success", result: { isSuccess: false, errorDesc: "Between 1 and 5 additional documents are allowed" } });
      app.extraDocuments += b.documentList.length;
      if (app.status === "NeedUpdate") { app.status = "Pending"; later(cfg.decisionDelayMs, () => decide(app, 1)); }
      return send(res, 200, { status: 200, message: "Success", result: { isSuccess: true, errorDesc: "" } });
    }
    return send(res, 404, { status: 404, message: "Incorrect Request" });
  }

  // ------------------------------------------------------------------ Anthropic Messages API (help assistant)
  // Enough of the real shape for the app's loop: the answer is picked from the last user text; tool questions get a tool_use first, then text built from the tool results.
  /** The "instruction checker" of the simulator: rejects the obvious, accepts plain guidance (a stand-in for a small model). */
  const reviewVerdict = (text) => (/REJECT-ME|ignore|reveal|password/i.test(text) ? { verdict: "reject", reason: "tries to change the rules" } : { verdict: "ok", reason: "" });
  /** Gemini generateContent + model list, in the real shapes. The key travels in x-goog-api-key. */
  async function googleMock(req, res, path) {
    if (!req.headers["x-goog-api-key"]) return send(res, 403, { error: { code: 403, message: "API key not valid", status: "PERMISSION_DENIED" } });
    if (path === "/ai/v1beta/models" && req.method === "GET") return send(res, 200, { models: [{ name: "models/gemini-3-flash-preview", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-flash-lite-latest", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] }, { name: "models/gemini-2.5-flash-preview-tts", supportedGenerationMethods: ["generateContent"] }] });
    const m = path.match(/^\/ai\/v1beta\/models\/([^:]+):generateContent$/); if (!m || req.method !== "POST") return send(res, 404, { error: { code: 404, message: "not found", status: "NOT_FOUND" } });
    const model = decodeURIComponent(m[1]), body = await readBody(req);
    if (!Array.isArray(body?.contents)) return send(res, 400, { error: { code: 400, message: "bad request", status: "INVALID_ARGUMENT" } });
    if (!/^gemini-/.test(model) || /unknown/.test(model)) return send(res, 404, { error: { code: 404, message: `models/${model} is not found`, status: "NOT_FOUND" } });
    const system = body.systemInstruction?.parts?.map((p) => p.text).join("\n") ?? "";
    state.aiRequests.push({ provider: "google", model, system, tools: (body.tools?.[0]?.functionDeclarations ?? []).map((t) => t.name), generationConfig: body.generationConfig, messages: body.contents });
    if (state.aiBreak.google) return send(res, state.aiBreak.google, { error: { code: state.aiBreak.google, message: "Forced failure", status: "UNAVAILABLE" } });
    const usageMetadata = { promptTokenCount: 300, candidatesTokenCount: 50, thoughtsTokenCount: 10 };
    const reply = (parts, finishReason = "STOP") => send(res, 200, { candidates: [{ content: { role: "model", parts }, finishReason }], usageMetadata });
    const last = body.contents[body.contents.length - 1], lastParts = last.parts ?? [];
    if (lastParts.some((p) => p.functionResponse)) return reply([{ text: `Mock Gemini reply from tools: ${lastParts.map((p) => JSON.stringify(p.functionResponse.response)).join(" | ").slice(0, 600)}` }]);
    const text = lastParts.map((p) => p.text ?? "").join(" ");
    if (/You check text that an administrator/.test(system)) return reply([{ text: JSON.stringify(reviewVerdict(text)) }]);
    const call = (name, args = {}) => reply([{ functionCall: { name, args }, thoughtSignature: "mock-signature" }]);
    if (/application|status|สถานะ/i.test(text)) return call("get_my_applications");
    if (/fee|price|cost|ราคา/i.test(text)) return call("get_fees");
    return reply([{ text: `Mock Gemini answer: ${text.slice(0, 200)}` }]);
  }

  async function anthropicMock(req, res) {
    const key = req.headers["x-api-key"] ?? String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""), body = await readBody(req);      // the current SDK sends the key as a Bearer token; older ones as x-api-key
    if (!key) return send(res, 401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
    if (!body || !Array.isArray(body.messages) || typeof body.model !== "string") return send(res, 400, { type: "error", error: { type: "invalid_request_error", message: "bad request" } });
    state.aiRequests.push({ provider: "anthropic", model: body.model, system: body.system, tools: (body.tools ?? []).map((t) => t.name), output_config: body.output_config, messages: body.messages });
    const last = body.messages[body.messages.length - 1];
    const usage = { input_tokens: 400, output_tokens: 60, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
    const reply = (content, stop_reason) => send(res, 200, { id: `msg_mock_${++state.seq}`, type: "message", role: "assistant", model: body.model, content, stop_reason, stop_sequence: null, usage });
    if (Array.isArray(last.content) && last.content.some((c) => c.type === "tool_result")) {
      const results = last.content.filter((c) => c.type === "tool_result").map((c) => (typeof c.content === "string" ? c.content : JSON.stringify(c.content))).join(" | ");
      return reply([{ type: "text", text: `Mock reply from tools: ${results.slice(0, 600)}` }], "end_turn");
    }
    const text = typeof last.content === "string" ? last.content : (last.content ?? []).map((c) => c.text ?? "").join(" ");
    const use = (name, input = {}) => reply([{ type: "text", text: "Let me check." }, { type: "tool_use", id: `toolu_mock_${++state.seq}`, name, input }], "tool_use");
    if (state.aiBreak.anthropic) return send(res, state.aiBreak.anthropic, { type: "error", error: { type: "api_error", message: "Forced failure" } });
    if (/You check text that an administrator/.test(String(body.system))) return reply([{ type: "text", text: JSON.stringify(reviewVerdict(text)) }], "end_turn");
    if (/BREAK-API/.test(text)) return send(res, 529, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } });
    if (/application|status|สถานะ/i.test(text)) return use("get_my_applications");
    if (/fee|price|cost|ราคา/i.test(text)) return use("get_fees");
    if (/eligib|nationalit/i.test(text)) return use("check_eligibility", { nationality: "India" });
    return reply([{ type: "text", text: `Mock answer: ${text.slice(0, 200)}` }], "end_turn");
  }

  // ------------------------------------------------------------------ LINE Messaging API + WhatsApp Cloud API (notifications)
  // push: records the message, answers like the real services; "FAIL" in the text or a user id ending in BLOCKED simulate a refusal.
  async function messaging(req, res, path, url) {
    const body = await readBody(req); const auth = String(req.headers.authorization ?? "");
    if (path === "/line/v2/bot/message/push") {
      if (!auth.startsWith("Bearer ")) return send(res, 401, { message: "Authentication failed" });
      const to = String(body.to ?? ""), text = (body.messages ?? []).map((m) => m.text ?? "").join("\n");
      if (!to || !Array.isArray(body.messages)) return send(res, 400, { message: "The request body has 1 error(s)" });
      if (to.endsWith("BLOCKED")) return send(res, 400, { message: "Failed to send messages" });
      state.messagesSent.push({ channel: "line", to, text }); return send(res, 200, { sentMessages: [{ id: String(++state.seq) }] });
    }
    if (path === "/line/v2/bot/message/reply") {
      if (!auth.startsWith("Bearer ")) return send(res, 401, { message: "Authentication failed" });
      state.messagesSent.push({ channel: "line-reply", to: String(body.replyToken ?? ""), text: (body.messages ?? []).map((m) => m.text ?? "").join("\n") }); return send(res, 200, {});
    }
    const wa = /^\/whatsapp\/v\d+\.\d+\/([^/]+)\/messages$/.exec(path);
    if (wa) {
      if (!auth.startsWith("Bearer ")) return send(res, 401, { error: { message: "Invalid OAuth access token", code: 190 } });
      if (!body.to || (body.type === "template" ? !body.template?.name : body.type !== "text")) return send(res, 400, { error: { message: "Parameter value is not valid", code: 100 } });
      if (String(body.to).endsWith("000")) return send(res, 400, { error: { message: "Recipient phone number not in allowed list", code: 131030 } });
      state.messagesSent.push({ channel: "whatsapp", to: String(body.to), template: body.template?.name ?? null, params: (body.template?.components ?? []).flatMap((c) => (c.parameters ?? []).map((p) => p.text)), text: body.text?.body ?? null });
      return send(res, 200, { messaging_product: "whatsapp", contacts: [{ input: body.to, wa_id: body.to }], messages: [{ id: `wamid.${++state.seq}` }] });
    }
    return send(res, 404, { message: "not found" });
  }

  // ------------------------------------------------------------------ partners (shared auth)
  const partnerAuth = (req, res) => {
    if (!cfg.partnerAuth) return true;
    const ts = req.headers["timestamp"], key = req.headers["key"], sig = req.headers["x-api-key"];
    if (!ts || !key || !sig || key !== cfg.partnerPublicKey || !eq(String(sig), signPartner(cfg.partnerSecret, ts))) { send(res, 401, { status: 401, message: "Not authorized" }); return false; }
    return true;
  };
  const packageList = (list, category) => (req, res, url) => {
    const cat = url.searchParams.get("category"); const lang = url.searchParams.get("lang") ?? "EN";
    const items = list.filter((p) => !cat || p.package_category === cat || (category === "SIM" && cat === "SIM" && p.package_category === "SIM") || (category === "SIM" && cat === "ESIM" && p.package_category === "ESIM"));
    return send(res, 200, { status: 0, message: "Success", lang, result: category === "SIM" && !cat ? list : items });
  };
  const need = (b, fields) => fields.filter((f) => b[f] === undefined || b[f] === null || b[f] === "");
  const tx = (prefix) => `${prefix}_TRN${String(++state.seq).padStart(8, "0")}X`;

  async function partner(req, res, path, url) {
    // ---- insurance (CIS): Bearer + g-api-key
    if (path.startsWith("/insurance/files/") && req.method === "GET") {       // downloads need no key (the real partner sends links like this)
      const name = decodeURIComponent(path.slice("/insurance/files/".length));
      if (name.endsWith("-ecard.png")) { const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"); res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length }); return res.end(png); }
      const pdf = Buffer.from(SAMPLE_PDF.replace("SIMULATED E-VOA", `SIMULATED INSURANCE CERTIFICATE ${name}`)); res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": pdf.length }); return res.end(pdf);
    }
    if (path.startsWith("/insurance/CIS/")) {
      if (!req.headers["g-api-key"] || !String(req.headers["authorization"] ?? "").startsWith("Bearer ")) return send(res, 401, { status: "error", message: "Not authorized" });
      if (path.endsWith("/travelPAPolicyIssueService") && req.method === "POST") {
        const b = await readBody(req);
        const required = ["RequestNo", "CountryName", "PlanCode", "PolicyUnit", "PolicyType", "PolicyDate", "ExpiryDate", "NumberPerson", "NetAmount", "Amount", "CustomerType", "CustomerPrefix", "CustomerName", "CustomerSureName", "CardType", "IdCard", "Email", "InsurePrefix", "InsureName", "InsureSurName", "InsureCardType", "InsureIdCard", "InsureEmail", "Address1"];
        const missing = need(b, required);
        if (missing.length) return send(res, 200, { status: "error", data: Object.fromEntries(missing.map((m) => [m, [`The ${m.replace(/([A-Z])/g, " $1").toLowerCase().trim()} field is required.`]])), 0: "Validation Error" });
        if (!INSURANCE_PLANS.some((p) => p.PlanCode === b.PlanCode)) return send(res, 200, { status: "error", data: { PlanCode: ["Invalid PlanCode."] }, 0: "Validation Error" });
        if (state.insurance.has(b.RequestNo)) return send(res, 200, { status: "error", data: { RequestNo: ["Duplicate RequestNo."] }, 0: "Validation Error" });
        const origin = `http://${req.headers.host ?? "localhost:4010"}`;
        const policy = { RequestNo: b.RequestNo, policy_status: "SUCCESS", policy_no: `POL${String(++state.seq).padStart(7, "0")}`, policy_url: `${origin}/insurance/files/${encodeURIComponent(b.RequestNo)}.pdf`, policy_remark: "", invoice_No: `INV${state.seq}` };
        state.insurance.set(b.RequestNo, policy);
        later(Math.min(cfg.decisionDelayMs, 1500), () => callback("insurance", "/Confirm_COI", { ...policy, policy_status: "Success", ecard_url: `${origin}/insurance/files/${encodeURIComponent(b.RequestNo)}-ecard.png` }));
        return send(res, 200, { status: "success", data: policy });
      }
      return send(res, 404, { status: "error", message: "Incorrect Request" });
    }

    if (!partnerAuth(req, res)) return;

    // ---- SIM / eSIM
    if (path === "/sim/wechat/package_list" && req.method === "GET") return packageList(SIM_PACKAGES, "SIM")(req, res, url);
    if (path === "/sim/SIM/TRUE/sim_buy" && req.method === "POST") {
      const b = await readBody(req); const missing = need(b, ["PaymentReceiptRefNumber", "WebReferenceNumber", "GivenName", "SurName", "PassportNumber", "ArrivalAirportId", "ArrivalDate", "ArrivalFlightNumber", "PackageCode", "PackagePriceTHB"]);
      const pkg = SIM_PACKAGES.find((p) => p.package_code === b.PackageCode);
      if (missing.length || !pkg) return send(res, 200, { status: 1, message: missing.length ? `Missing: ${missing.join(", ")}` : "Invalid PackageCode" });
      if (pkg.package_category === "SIM" && !b.bioImage) return send(res, 200, { status: 1, message: "Missing: bioImage (passport bio page) is required for a physical SIM" });
      const TransactionID = tx(pkg.package_category === "ESIM" ? "ESIM-01" : "SIM-01"); const rec = { ...b, bioImage: b.bioImage ? "[omitted]" : undefined, TransactionID, used: false }; state.sim.set(TransactionID, rec);
      const result = { paymentReceiptRefNumber: b.PaymentReceiptRefNumber, webReferenceNumber: b.WebReferenceNumber, TransactionID };
      if (pkg.package_category === "ESIM") result.esim = { lpa: `LPA:1$mock.invalid$${TransactionID}`, qr_url: `https://mock.invalid/esim/${TransactionID}.png` };
      return send(res, 200, { status: 0, message: "Success", result });
    }
    // ---- VIP
    if (path === "/vip/wechat/package_list" && req.method === "GET") return packageList(VIP_PACKAGES, "VIP")(req, res, url);
    if (path === "/vip/Services/VIP/vip_buy" && req.method === "POST") {
      const b = await readBody(req); const missing = need(b, ["PaymentReceiptRefNumber", "WebReferenceNumber", "GivenName", "SurName", "PassportNumber", "ArrivalAirportId", "ArrivalDate", "ArrivalTime", "ArrivalFlightNumber", "PackageCode", "PackagePriceTHB"]);
      if (missing.length || !VIP_PACKAGES.some((p) => p.package_code === b.PackageCode)) return send(res, 200, { status: 1, message: missing.length ? `Missing: ${missing.join(", ")}` : "Invalid PackageCode" });
      const TransactionID = tx("VIP-01"); state.vip.set(TransactionID, { ...b, TransactionID, used: false });
      return send(res, 200, { status: 0, message: "Success", result: { paymentReceiptRefNumber: b.PaymentReceiptRefNumber, webReferenceNumber: b.WebReferenceNumber, TransactionID } });
    }
    // ---- Beauty & Health
    if (path === "/bhs/wechat/package_list" && req.method === "GET") return packageList(BHS_PACKAGES, "BHS")(req, res, url);
    if (path === "/bhs/wechat/gen_health_voucher" && req.method === "POST") {
      const b = await readBody(req); const missing = need(b, ["packageCode", "PaymentReceiptRefNumber", "WebReferenceNumber", "GivenName", "SurName", "PassportNumber", "DateOfBirth", "Email", "Mobile", "ArrivalDate"]);
      if (missing.length || !BHS_PACKAGES.some((p) => p.package_code === b.packageCode)) return send(res, 200, { status: 1, message: missing.length ? `Missing: ${missing.join(", ")}` : "Invalid packageCode" });
      const voucherCode = randomUUID().replace(/-/g, ""); state.bhs.set(voucherCode, { ...b, voucherCode, state: "VALID" });
      return send(res, 200, { status: 0, message: "Success", result: { paymentReceiptRefNumber: b.PaymentReceiptRefNumber, webReferenceNumber: b.WebReferenceNumber, voucherCode, voucherUrl: `https://mock.invalid/voucher/${voucherCode}.pdf` } });
    }
    if (path === "/bhs/wechat/voucher/verify" && req.method === "POST") { // what the clinic calls on the BHS backend
      const b = await readBody(req); const v = state.bhs.get(b.VoucherCode ?? "");
      return send(res, 200, { status: 0, message: "Success", result: { state: !v ? "INVALID" : v.state } });
    }
    return send(res, 404, { status: 404, message: "Incorrect Request" });
  }

  // ------------------------------------------------------------------ flight information (stand-in for a flight data provider)
  const AIRLINES = { TG: ["Thai Airways", "DEL", "IN"], AI: ["Air India", "DEL", "IN"], "6E": ["IndiGo", "BOM", "IN"], EK: ["Emirates", "DXB", "AE"], CA: ["Air China", "PEK", "CN"], MU: ["China Eastern", "PVG", "CN"], CI: ["China Airlines", "TPE", "TW"], SU: ["Aeroflot", "SVO", "RU"], KC: ["Air Astana", "ALA", "KZ"], SV: ["Saudia", "RUH", "SA"], BA: ["British Airways", "LHR", "GB"] };
  function flights(req, res, url) {
    const flight = (url.searchParams.get("flight") ?? "").toUpperCase().replace(/\s+/g, ""), date = url.searchParams.get("date") ?? "";
    const m = /^([A-Z0-9]{2})(\d{1,4})$/.exec(flight);
    if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !AIRLINES[m[1]]) return send(res, 404, { error: "flight not found" });
    const n = Number(m[2]); const hh = String(n % 24).padStart(2, "0"), mm = ["05", "15", "35", "50"][n % 4];
    const [name, origin, country] = AIRLINES[m[1]];
    return send(res, 200, { flight: `${m[1]}${m[2]}`, date, airline: { iata: m[1], name }, origin: { iata: origin, country }, arrival: { iata: n % 7 === 0 ? "DMK" : n % 11 === 0 ? "HKT" : "BKK", scheduledLocal: `${hh}:${mm}` } });
  }

  // ------------------------------------------------------------------ simulator controls
  async function admin(req, res, path) {
    const b = req.method === "POST" ? await readBody(req) : {};
    if (path === "/__admin/state") return send(res, 200, { config: { ...cfg, partnerSecret: "***", callbackSecret: "***" }, applications: [...state.applications.values()], insurance: [...state.insurance.values()], sim: [...state.sim.values()], vip: [...state.vip.values()], bhs: [...state.bhs.values()], callbacksSent: state.callbacksSent, aiRequests: state.aiRequests, walletPatches: state.walletPatches, messagesSent: state.messagesSent });
    if (path === "/__admin/decide" && req.method === "POST") { const app = state.applications.get(b.webReferenceNumber); if (!app) return send(res, 404, { error: "unknown application" }); await decide(app, Number(b.statusId), b.statusDesc); return send(res, 200, { ok: true, status: app.status }); }
    if (path === "/__admin/config" && req.method === "POST") { for (const k of ["decisionDelayMs", "duplicateMode"]) if (b[k] !== undefined) cfg[k] = b[k]; for (const k of Object.keys(cfg.callbacks)) if (b.callbacks?.[k] !== undefined) cfg.callbacks[k] = b.callbacks[k]; return send(res, 200, { ok: true }); }
    if (path === "/__admin/ai-break" && req.method === "POST") { state.aiBreak = b?.provider ? { ...state.aiBreak, [b.provider]: b.status || 0 } : {}; return send(res, 200, { ok: true, aiBreak: state.aiBreak }); }
    if (path === "/__admin/reset" && req.method === "POST") { state.aiBreak = {}; for (const m of [state.applications, state.byPayment, state.insurance, state.sim, state.vip, state.bhs]) m.clear(); state.callbacksSent.length = 0; state.aiRequests.length = 0; state.walletPatches.length = 0; state.messagesSent.length = 0; state.errOnce.clear(); return send(res, 200, { ok: true }); }
    // partner-side events: the partner tells ThaiPass that something happened (SIM picked up, VIP used, voucher used, lab result)
    if (path === "/__admin/partner/sim-confirm" && req.method === "POST") { const r = state.sim.get(b.TransactionID); if (!r) return send(res, 404, { error: "unknown TransactionID" }); r.used = true; await callback("sim", "/SIM/TRUE/sim_confirm", { PassportNumber: r.PassportNumber, TransactionID: r.TransactionID, ConfirmBy: b.ConfirmBy ?? "airport-counter-1", Remark: b.Remark ?? "" }); return send(res, 200, { ok: true }); }
    if (path === "/__admin/partner/vip-confirm" && req.method === "POST") { const r = state.vip.get(b.TransactionID); if (!r) return send(res, 404, { error: "unknown TransactionID" }); r.used = true; await callback("vip", "/Services/VIP/vip_confirm", { PassportNumber: r.PassportNumber, TransactionID: r.TransactionID, ConfirmBy: b.ConfirmBy ?? "vip-staff-1", Remark: b.Remark ?? "" }); return send(res, 200, { ok: true }); }
    if (path === "/__admin/partner/bhs-confirm" && req.method === "POST") { const r = state.bhs.get(b.VoucherCode); if (!r) return send(res, 404, { error: "unknown voucher" }); r.state = "USED"; await callback("bhs", "/wechat/voucher/confirm_voucher", { VoucherCode: r.voucherCode, PassportNumber: r.PassportNumber, HospitalNumber: "HN-0001", HospitalCode: "MOCK-CLINIC", HospitalName: "Mock Wellness Clinic", TestedDate: new Date().toISOString().slice(0, 10), TestedTime: "10:30", Remark: b.Remark ?? "" }); return send(res, 200, { ok: true }); }
    if (path === "/__admin/partner/bhs-result" && req.method === "POST") { const r = state.bhs.get(b.VoucherCode); if (!r) return send(res, 404, { error: "unknown voucher" }); await callback("bhs", "/wechat/voucher/callback_result", { VoucherCode: r.voucherCode, PassportNumber: r.PassportNumber, HospitalNumber: "HN-0001", HospitalCode: "MOCK-CLINIC", HospitalName: "Mock Wellness Clinic", ReportDateTime: new Date().toISOString(), VaccinatedStatus: false, SpecimenDate: new Date().toISOString().slice(0, 10), LabReportResult: b.LabReportResult ?? "Normal", LabReportResultUrl: `https://mock.invalid/result/${r.voucherCode}.pdf` }); return send(res, 200, { ok: true }); }
    return send(res, 404, { error: "unknown admin route" });
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://mock.local"); const path = url.pathname;
      cfg.log(`${req.method} ${path}${url.search ? "?…" : ""}`);
      if (path === "/" || path === "/health") return send(res, 200, { ok: true, service: "thaipass-mock-partners" });
      if (path.startsWith("/__admin/")) return await admin(req, res, path);
      if (path.startsWith("/immigration/th/v1/")) return await immigration(req, res, path, url);
      if (path === "/flights/lookup") return flights(req, res, url);
      if (path === "/ai/v1/messages" && req.method === "POST") return await anthropicMock(req, res);
      if (path === "/ai/v1/models" && req.method === "GET") return send(res, 200, { data: [{ id: "claude-sonnet-5-5", type: "model" }, { id: "claude-haiku-5-5", type: "model" }, { id: "claude-opus-5-5", type: "model" }], has_more: false, first_id: "claude-sonnet-5-5", last_id: "claude-opus-5-5" });
      if (path.startsWith("/ai/v1beta/")) return await googleMock(req, res, path);
      // Google Wallet (updating a saved pass): OAuth token for a service account, then PATCH of the pass object (an id containing MISSING answers 404 like a pass nobody saved)
      if (path === "/wallet/token" && req.method === "POST") { const f = Object.fromEntries(new URLSearchParams(await readRaw(req))); return f.grant_type === "urn:ietf:params:oauth:grant-type:jwt-bearer" && String(f.assertion ?? "").split(".").length === 3 ? send(res, 200, { access_token: "mock-wallet-token", expires_in: 3600, token_type: "Bearer" }) : send(res, 400, { error: "invalid_grant" }); }
      if (path.startsWith("/wallet/walletobjects/v1/genericObject/") && req.method === "PATCH") {
        const body = await readBody(req), id = decodeURIComponent(path.split("/").pop());
        if (req.headers.authorization !== "Bearer mock-wallet-token") return send(res, 401, { error: { code: 401, message: "unauthorized" } });
        if (id.includes("MISSING")) return send(res, 404, { error: { code: 404, message: "Object not found" } });
        state.walletPatches.push({ id, state: body.state, text: JSON.stringify(body.textModulesData ?? []), header: body.header?.defaultValue?.value }); return send(res, 200, { id, ...body });
      }
      if (/^\/(line|whatsapp)\//.test(path)) return await messaging(req, res, path, url);
      if (/^\/(insurance|sim|vip|bhs)\//.test(path)) return await partner(req, res, path, url);
      return send(res, 404, { status: 404, message: "Incorrect Request" });
    } catch (e) { cfg.log(`error ${e.stack}`); send(res, 500, { status: 500, message: "Internal Server Error" }); }
  });
  return {
    server, state, cfg,
    listen: (port = 0) => new Promise((resolve) => server.listen(port, () => resolve(server.address().port))),
    close: () => { for (const t of timers) clearTimeout(t); return new Promise((r) => { server.close(() => r()); server.closeAllConnections?.(); }); },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mock = createMockServer();
  const port = Number(process.env.MOCK_PORT ?? 4010);
  await mock.listen(port);
  console.log(`ThaiPass mock partners listening on http://localhost:${port}`);
  console.log("  Immigration  /immigration/th/v1/   Insurance /insurance/CIS/   SIM /sim/   VIP /vip/   Health /bhs/   Controls /__admin/state");
}
