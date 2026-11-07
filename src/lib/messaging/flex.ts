// LINE Flex Message cards for notices. Pure (no network): a colored header by kind of notice, "label | value" rows, an optional note and one "Open" button.
// LINE refuses the WHOLE message when a field is too long, so every text is cut with "…" to its limit. `altText` is what the lock screen and the chat list show.
import { NOTICE_STYLES, LINE_TEXT, type NoticeStyle } from "@/config/line-colors";

export const LIMITS = { title: 100, label: 24, value: 120, note: 160, rows: 8, alt: 400, brand: 40 } as const;
const cut = (s: string, n: number) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** Which header a notice gets, from its kind ("application.approved", "payment.paid" …). Anything unknown is a plain info card. */
export function styleOf(kind?: string): NoticeStyle {
  const k = kind ?? "";
  if (/^application\.(approved|ready)$/.test(k) || /^addon\.(ready|issued)$/.test(k)) return k.startsWith("addon") ? "extra" : "success";
  if (/^application\.(rejected|submission_failed)$/.test(k) || /(failed|rejected)$/.test(k)) return "danger";
  if (/^application\.action_required$/.test(k) || /^rule\.(payment_reminder|fix_reminder|expired|sla_)/.test(k)) return "warning";
  if (/^application\.upgrade$/.test(k) || /^payment\.paid$/.test(k)) return "money";
  if (/refund/.test(k)) return "refund";
  if (/^(addon|partner|agency)\./.test(k)) return "extra";
  if (/^(reconcile|rule\.sla)/.test(k) || k.startsWith("staff")) return "staff";
  return "info";
}

export type FlexInput = { brand: string; title: string; fields?: [string, string][]; text?: string; note?: string; url?: string; buttonLabel: string; kind?: string };

/** The URL a button opens: the full address plus openExternalBrowser=1, so it opens in the phone's browser (LINE's own browser asks to sign in again). Only http(s) addresses are accepted. */
export function externalUrl(url: string): string | null {
  try { const u = new URL(url); if (u.protocol !== "https:" && u.protocol !== "http:") return null; u.searchParams.set("openExternalBrowser", "1"); return u.toString(); } catch { return null; }
}

export function buildFlex(i: FlexInput) {
  const st = NOTICE_STYLES[styleOf(i.kind)], title = cut(i.title, LIMITS.title) || "…";
  const rows = (i.fields ?? []).filter(([l, v]) => cut(l, 1) && cut(v, 1)).slice(0, LIMITS.rows).map(([l, v]) => [cut(l, LIMITS.label), cut(v, LIMITS.value)] as const);
  const url = i.url ? externalUrl(i.url) : null;
  const body = rows.length
    ? rows.map(([l, v]) => ({ type: "box", layout: "horizontal", spacing: "md", contents: [{ type: "text", text: l, size: "sm", color: LINE_TEXT.muted, flex: 3, wrap: true }, { type: "text", text: v, size: "sm", weight: "bold", color: LINE_TEXT.ink, flex: 5, wrap: true, align: "end" }] }))
    : [{ type: "text", text: cut(i.text ?? "", 300) || title, size: "sm", color: LINE_TEXT.ink, wrap: true }];
  const note = i.note ? cut(i.note, LIMITS.note) : "";
  const bubble: Record<string, unknown> = {
    type: "bubble", size: "mega",
    header: { type: "box", layout: "vertical", backgroundColor: st.color, paddingAll: "16px", spacing: "sm", contents: [
      { type: "text", text: `${st.emoji} ${cut(i.brand, LIMITS.brand)}`, size: "xs", weight: "bold", color: LINE_TEXT.white },
      { type: "text", text: title, size: "lg", weight: "bold", color: LINE_TEXT.white, wrap: true } ] },
    body: { type: "box", layout: "vertical", spacing: "md", paddingAll: "16px", contents: body },
    footer: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px", contents: [
      ...(note ? [{ type: "text", text: note, size: "xs", color: LINE_TEXT.muted, align: "center", wrap: true }] : []),
      ...(url ? [{ type: "button", style: "primary", color: st.color, height: "sm", action: { type: "uri", label: cut(i.buttonLabel, 20) || "Open", uri: url } }] : []) ] },
  };
  if (!(bubble.footer as { contents: unknown[] }).contents.length) delete bubble.footer;
  const alt = cut([title, ...(rows.length ? [rows.map(([l, v]) => `${l} ${v}`).join(" · ")] : i.text ? [cut(i.text, 250)] : [])].join(" — "), LIMITS.alt);
  return { type: "flex" as const, altText: alt, contents: bubble };
}
