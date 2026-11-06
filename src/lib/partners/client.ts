import { createHmac } from "node:crypto";
import { envValue } from "@/lib/env";

// Calls to the partners. Same endpoints and field names as in "Flow & API Docs" (see tools/mock-partners). Responses are {status:0,message,result} (SIM, VIP, health) or {status:"success"|"error",data} (insurance).
export type Provider = "insurance" | "sim" | "vip" | "bhs";

export class PartnerError extends Error {
  constructor(public kind: "unavailable" | "refused" | "auth" | "unexpected", message: string, public httpStatus?: number) { super(message); }
  get retryable() { return this.kind === "unavailable"; }
}

const URL_ENV: Record<Provider, string> = { insurance: "PARTNER_INSURANCE_URL", sim: "PARTNER_SIM_URL", vip: "PARTNER_VIP_URL", bhs: "PARTNER_BHS_URL" };
export const partnerBase = (p: Provider) => envValue(URL_ENV[p]).replace(/\/$/, "");
export const partnerConfigured = (p: Provider) => !!partnerBase(p) && (p === "insurance" ? !!envValue("INSURANCE_G_API_KEY") && !!envValue("INSURANCE_TOKEN") : !!envValue("PARTNER_SECRET") && !!envValue("PARTNER_PUBLIC_KEY"));

/** X-API-KEY = HMAC-SHA256(secret, timestamp). The original documents show this only as a picture: confirm the real algorithm with each partner. */
export const signPartner = (secret: string, timestamp: string) => createHmac("sha256", secret).update(timestamp).digest("hex");

function headers(p: Provider): Record<string, string> {
  const base = { "Content-Type": "application/json", Accept: "application/json" };
  if (p === "insurance") return { ...base, "g-api-key": envValue("INSURANCE_G_API_KEY"), Authorization: `Bearer ${envValue("INSURANCE_TOKEN")}` };
  const ts = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return { ...base, "X-API-KEY": signPartner(envValue("PARTNER_SECRET"), ts), timestamp: ts, key: envValue("PARTNER_PUBLIC_KEY") };
}

export async function partnerCall<T = unknown>(p: Provider, method: "GET" | "POST", path: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
  const base = partnerBase(p);
  if (!base) throw new PartnerError("refused", `${p} is not configured`);
  const url = `${base}${path}${query ? `?${new URLSearchParams(query)}` : ""}`;
  let res: Response;
  try { res = await fetch(url, { method, headers: headers(p), body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
  catch (e) { throw new PartnerError("unavailable", `cannot reach ${p}: ${(e as Error).message}`); }
  if (res.status === 401 || res.status === 403) throw new PartnerError("auth", `${p} refused our credentials`, res.status);
  if (res.status >= 500) throw new PartnerError("unavailable", `${p} answered ${res.status}`, res.status);
  const json = (await res.json().catch(() => null)) as unknown;
  if (!json || typeof json !== "object") throw new PartnerError("unexpected", `${p} answered something that is not JSON`, res.status);
  return json as T;
}

export type PartnerPackage = { package_code: string; package_category: string; package_name: string; package_detail?: string | null; package_price_thb: string; package_price_usd?: string | null; package_price_cny?: string | null; package_image?: string | null; terms_of_use?: string | null; ref_link?: string | null };

const PACKAGE_PATH: Record<Exclude<Provider, "insurance">, string> = { sim: "/wechat/package_list", vip: "/wechat/package_list", bhs: "/wechat/package_list" };
const CATEGORY_ARG: Record<string, string> = { sim: "SIM", esim: "ESIM", vip: "SERVICE", health: "HEALTH" };

export async function listPackages(p: Exclude<Provider, "insurance">, category: "sim" | "esim" | "vip" | "health"): Promise<PartnerPackage[]> {
  const r = await partnerCall<{ status: number; result?: PartnerPackage[] }>(p, "GET", PACKAGE_PATH[p], undefined, { category: CATEGORY_ARG[category], lang: "EN" });
  if (r.status !== 0 || !Array.isArray(r.result)) throw new PartnerError("unexpected", `${p} package list failed`);
  return r.result.filter((x) => x && typeof x.package_code === "string" && Number.isFinite(Number(x.package_price_thb)));
}
