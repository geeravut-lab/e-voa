/**
 * Feature switches. The list lives in code; the database stores only the ones switched OFF (see lib/flags.ts).
 * Adding a key here never turns anything off.
 */
export const FEATURE_FLAGS = {
  login_google: { label: "Sign in with Google" },
  login_line: { label: "Sign in with LINE (Aivora)" },
  login_email: { label: "Sign in with email code" },
  notifications: { label: "In-app notifications" },
  live_sync: { label: "Live updates without refreshing" },
  apply: { label: "e-VOA application" },
  eligibility: { label: "Eligibility check" },
  extras: { label: "Travel extras (eSIM, insurance, VIP, health)" },
  ai_assistant: { label: "AI assistant" },
} as const;

export type FeatureKey = keyof typeof FEATURE_FLAGS;
export const FEATURE_KEYS = Object.keys(FEATURE_FLAGS) as FeatureKey[];
