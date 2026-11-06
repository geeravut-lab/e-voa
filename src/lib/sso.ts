import { z } from "zod";

/** Hub payload. Fields the hub cannot fill come back as null (LINE users often have no email), so null must be accepted. */
const nullableString = z.string().nullable().optional();
export const HubExchangeSchema = z.object({
  user: z.object({
    id: z.string().min(1),                     // the one field that must be a real, non-empty string
    display_name: nullableString,
    avatar_url: nullableString,
    email: nullableString,
    roles: z.unknown().optional(),             // never used: permissions are decided by this app only
  }),
  app_slug: z.string(),
  firebase: z.unknown().nullable().optional(), // always null for Supabase apps: correct, not an error
});
export type HubExchange = z.infer<typeof HubExchangeSchema>;

/** Placeholder address for LINE users without an email. It can never receive mail and never collides with a real address. */
export const syntheticEmail = (aivoraUserId: string, host: string) => `aivora+${aivoraUserId.replace(/[^a-zA-Z0-9._-]/g, "_")}@${host}`;

export type SsoError = { status: 401 | 403 | 502; code: "err_sso_ticket" | "err_sso_slug" | "err_sso_hub" };
export function checkSlug(payload: HubExchange, expected: string): SsoError | null {
  return payload.app_slug === expected ? null : { status: 403, code: "err_sso_slug" };
}
