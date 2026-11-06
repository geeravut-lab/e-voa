// Single place that reads environment variables.
// NEXT_PUBLIC_* must be referenced literally so Next.js can inline them in the browser bundle.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://e-voa.vercel.app";
export const LIVE_REALTIME = process.env.NEXT_PUBLIC_LIVE_REALTIME !== "0";

/** True when the public Supabase settings exist. Without them the site still renders as a signed-out visitor. */
export const hasSupabase = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** A server setting. A value left as "null", "none", "-" or blank (typed into the Vercel form to mean "not set") counts as NOT set, so it can never be used as an address or a secret. */
export const envValue = (name: string): string => {
  const v = (process.env[name] ?? "").trim();
  return /^(null|undefined|none|n\/a|-)?$/i.test(v) ? "" : v;
};

// ---- server only (never import this block from a client component) ----
export const serverEnv = () => ({
  serviceRoleKey: envValue("SUPABASE_SERVICE_ROLE_KEY"),
  hubUrl: (process.env.AIVORA_HUB_URL || "https://aivora-lc.netlify.app").replace(/\/$/, ""),
  appSlug: process.env.AIVORA_APP_SLUG || "e-voa",
  cronSecret: envValue("CRON_SECRET"),
});
export const hasServiceRole = () => Boolean(SUPABASE_URL && serverEnv().serviceRoleKey);
