import "server-only";
import { envValue } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// E-mail through Resend's HTTP API. RESEND_API_KEY must be set; MAIL_FROM defaults to Resend's test sender, which can only deliver to the owner of the Resend account.
// RESEND_API_URL exists so tests can point at a local fake.
export const mailConfigured = () => Boolean(envValue("RESEND_API_KEY"));

export type MailAttachment = { filename: string; content: Buffer };
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Wraps a title and plain-text lines in a simple, readable e-mail (inline styles: mail clients ignore stylesheets). */
export function renderMail(a: { brand: string; title: string; lines: string[]; button?: { text: string; url: string }; footer: string }) {
  const body = a.lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${esc(l)}</p>`).join("");
  const btn = a.button ? `<p style="margin:20px 0"><a href="${esc(a.button.url)}" style="background:rgb(21,87,224);color:white;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;display:inline-block">${esc(a.button.text)}</a></p>` : "";
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:rgb(20,30,50)"><p style="font-weight:800;font-size:18px;margin:0 0 16px">${esc(a.brand)}</p><h1 style="font-size:20px;margin:0 0 12px">${esc(a.title)}</h1>${body}${btn}<hr style="border:0;border-top:1px solid rgb(221,227,238);margin:20px 0"><p style="font-size:12px;color:rgb(100,110,130);margin:0">${esc(a.footer)}</p></div>`;
  const text = [a.title, "", ...a.lines, a.button ? `${a.button.text}: ${a.button.url}` : "", "", a.footer].filter((x, i, arr) => !(x === "" && arr[i - 1] === "")).join("\n");
  return { html, text };
}

/** Counts how mail is going (kind, ok, HTTP code): never an address or a message. A logging problem never changes the result. */
async function logMail(kind: string, ok: boolean, code: number | null) {
  try { await createAdminClient().from("mail_log").insert({ kind: kind.slice(0, 40), ok, code }); } catch { /* best effort */ }
}

export async function sendMail(m: { to: string; subject: string; html: string; text: string; attachments?: MailAttachment[]; kind?: string; headers?: Record<string, string> }): Promise<boolean> {
  const key = envValue("RESEND_API_KEY");
  if (!key) return false;
  const kind = m.kind ?? "other";
  try {
    const res = await fetch(envValue("RESEND_API_URL") || "https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ from: envValue("MAIL_FROM") || "ThaiPass e-VOA <onboarding@resend.dev>", to: [m.to], subject: m.subject.slice(0, 200), html: m.html, text: m.text, ...(m.headers ? { headers: m.headers } : {}),
        ...(m.attachments?.length ? { attachments: m.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) } : {}) }),
    });
    if (!res.ok) console.error("[mail] provider answered", res.status, (await res.text().catch(() => "")).slice(0, 200));
    await logMail(kind, res.ok, res.status);
    return res.ok;
  } catch (e) { console.error("[mail] send failed", (e as Error).message); await logMail(kind, false, null); return false; }
}
