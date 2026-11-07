// Pay-later links. PURE except for hashing: the screens, the server and the tests share these rules.
import { createHash, randomBytes } from "node:crypto";

export const LINK_TTL_HOURS = 72;
/** A 256-bit secret in the address. Only its hash is stored, so a copy of the database cannot be used to pay or to look anything up. */
export const newToken = () => randomBytes(32).toString("base64url");
export const validToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);
export const hashToken = (t: string) => createHash("sha256").update(`paylink:${t}`).digest("hex");

export type LinkState = "active" | "expired" | "revoked";
export const linkState = (l: { expires_at: string; revoked_at: string | null }, now: Date): LinkState => (l.revoked_at ? "revoked" : Date.parse(l.expires_at) <= now.getTime() ? "expired" : "active");
/** The link never outlives the application it pays for. */
export const linkExpiry = (now: Date, applicationClosesAtMs?: number) => new Date(Math.min(now.getTime() + LINK_TTL_HOURS * 3_600_000, applicationClosesAtMs ?? Infinity));
/** What the payer may see of a traveler: given name and the first letter of the surname. Never a passport detail. */
export const shortName = (given: string | null | undefined, surname: string | null | undefined) => `${(given ?? "").trim()} ${(surname ?? "").trim().slice(0, 1)}${(surname ?? "").trim() ? "." : ""}`.trim() || "—";
