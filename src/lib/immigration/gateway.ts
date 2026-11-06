import { Docket, DocketResult, MasterItem, type MasterName } from "./schema";
import { envValue } from "@/lib/env";

/** What can go wrong when talking to Immigration, in terms the caller can act on. */
export type ImmigrationErrorKind = "auth" | "bad_request" | "unavailable" | "unexpected";
export class ImmigrationError extends Error {
  constructor(public kind: ImmigrationErrorKind, message: string, public httpStatus?: number) {
    super(message);
  }
  /** Worth trying again later? Network trouble and 5xx yes; wrong credentials or a refused request no. */
  get retryable() { return this.kind === "unavailable"; }
}

export interface ImmigrationGateway {
  master(name: MasterName, parentId?: number): Promise<MasterItem[]>;
  submitDocket(docket: Docket): Promise<DocketResult>;
  status(webReferenceNumber: string, paymentReceiptRefNumber: string): Promise<string | null>;
  evoa(webReferenceNumber: string, paymentReceiptRefNumber: string): Promise<Buffer | null>;
  uploadAdditionalDocuments(a: { batchReference: string; paymentReceiptNumber: string; webReferenceNumber: string; documentList: Docket["Applicants"][number]["documentList"] }): Promise<void>;
}

export type GatewayConfig = { baseUrl: string; token: string; from: string; timeoutMs?: number; fetchImpl?: typeof fetch };

/** Talks to the Immigration API (or the simulator in tools/mock-partners: same paths, same fields). */
export class HttpImmigrationGateway implements ImmigrationGateway {
  private base: string;
  constructor(private cfg: GatewayConfig) { this.base = cfg.baseUrl.replace(/\/$/, ""); }

  private async request<T = unknown>(method: "GET" | "POST", path: string, body?: unknown, retries = 0): Promise<T> {
    const f = this.cfg.fetchImpl ?? fetch;
    let last: ImmigrationError | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 300 * 2 ** (attempt - 1)));
      try {
        const res = await f(`${this.base}${path}`, {
          method,
          headers: { Authorization: this.cfg.token, From: this.cfg.from, "Content-Type": "application/json", Accept: "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 20_000),
          cache: "no-store",
        });
        if (res.status === 401 || res.status === 403) throw new ImmigrationError("auth", "Immigration refused our credentials", res.status);
        if (res.status === 400 || res.status === 404) throw new ImmigrationError("bad_request", `Immigration refused the request (${res.status})`, res.status);
        if (res.status >= 500) throw new ImmigrationError("unavailable", `Immigration answered ${res.status}`, res.status);
        if (!res.ok) throw new ImmigrationError("unexpected", `Unexpected status ${res.status}`, res.status);
        const json = (await res.json().catch(() => null)) as { result?: T } | null;
        if (!json || typeof json !== "object") throw new ImmigrationError("unexpected", "Answer was not JSON", res.status);
        return (json.result ?? (json as unknown)) as T;
      } catch (e) {
        if (e instanceof ImmigrationError) { last = e; if (!e.retryable) throw e; }
        else last = new ImmigrationError("unavailable", `Cannot reach Immigration: ${(e as Error).message}`);
      }
    }
    throw last!;
  }

  async master(name: MasterName, parentId?: number) {
    const path = parentId === undefined ? `/master/${name}` : `/master/${name}/${parentId}`;
    const list = await this.request<unknown[]>("GET", path, undefined, 2);
    if (!Array.isArray(list)) throw new ImmigrationError("unexpected", `master/${name} did not return a list`);
    return list.flatMap((x) => { const p = MasterItem.safeParse(x); return p.success ? [p.data] : []; });
  }

  async submitDocket(docket: Docket) {
    const parsed = DocketResult.safeParse(await this.request("POST", "/application/docket", docket));   // no automatic retry: the outbox decides
    if (!parsed.success) throw new ImmigrationError("unexpected", "docket answer has an unexpected shape");
    return parsed.data;
  }

  async status(web: string, pay: string) {
    const q = new URLSearchParams({ webReferenceNumber: web, paymentReceiptRefNumber: pay });
    const r = await this.request<{ isSuccess?: boolean; Status?: string }>("GET", `/application/getStatusById?${q}`, undefined, 2);
    return r.isSuccess && typeof r.Status === "string" ? r.Status : null;
  }

  async evoa(web: string, pay: string) {
    const q = new URLSearchParams({ webReferenceNumber: web, paymentReceiptRefNumber: pay });
    const r = await this.request<{ isSuccess?: boolean; evoaContent?: string }>("GET", `/application/getEVOAById?${q}`, undefined, 2);
    return r.isSuccess && r.evoaContent ? Buffer.from(r.evoaContent, "base64") : null;
  }

  async uploadAdditionalDocuments(a: Parameters<ImmigrationGateway["uploadAdditionalDocuments"]>[0]) {
    if (a.documentList.length === 0 || a.documentList.length > 5) throw new ImmigrationError("bad_request", "1 to 5 additional documents are allowed");
    const r = await this.request<{ isSuccess?: boolean; errorDesc?: string }>("POST", "/application/uploadAdditionalDocuments", a);
    if (!r.isSuccess) throw new ImmigrationError("bad_request", r.errorDesc || "Immigration did not accept the documents");
  }
}

/** Reads IMMIGRATION_API_URL / IMMIGRATION_API_TOKEN / IMMIGRATION_API_FROM. Returns null when not configured. */
export function gatewayFromEnv(): ImmigrationGateway | null {
  const baseUrl = envValue("IMMIGRATION_API_URL"), token = envValue("IMMIGRATION_API_TOKEN"), from = envValue("IMMIGRATION_API_FROM");
  if (!baseUrl || !token || !from) return null;
  return new HttpImmigrationGateway({ baseUrl, token, from });
}
export const immigrationHost = () => { try { return new URL(envValue("IMMIGRATION_API_URL")).host; } catch { return ""; } };
