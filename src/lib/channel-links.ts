// Turns the official contact details into links the phone can act on: a LINE ID opens LINE's "add friend" page, a phone number starts a call. PURE.

/** "@269usddf" (an official account) → the LINE add-friend link. Anything that does not look like a LINE ID gives no link, so odd text is never turned into an address. */
export function lineHref(raw: string): string | null {
  const id = raw.trim();
  if (!/^@?[A-Za-z0-9._-]{3,30}$/.test(id)) return null;
  return id.startsWith("@") ? `https://line.me/R/ti/p/${encodeURIComponent(id)}` : `https://line.me/ti/p/~${encodeURIComponent(id)}`;          // @id: official account · id: personal LINE ID
}

/** "+66-94-612-0581" or "094 612 0581" → "tel:+66946120581": only digits and a leading +, so spaces, dashes and brackets never reach the dialer. Fewer than 5 digits gives no link. */
export function telHref(raw: string): string | null {
  const t = raw.trim();
  if (!/^[+\d\s()-]{5,30}$/.test(t)) return null;
  const digits = t.replace(/\D/g, "");
  return digits.length >= 5 ? `tel:${t.startsWith("+") ? "+" : ""}${digits}` : null;
}
