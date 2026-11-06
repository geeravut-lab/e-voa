import "server-only";
import { notFound } from "next/navigation";
import { getSetting, putSetting } from "@/lib/settings";
import { FEATURE_FLAGS, type FeatureKey } from "@/config/features";

type Stored = Partial<Record<string, boolean>>;

/** Only switched-OFF flags are stored. A key that is missing means "on", so new features are never disabled by accident. */
export async function loadFlags(): Promise<Record<FeatureKey, boolean>> {
  const stored = await getSetting<Stored>("feature_flags", {});
  const out = {} as Record<FeatureKey, boolean>;
  for (const k of Object.keys(FEATURE_FLAGS) as FeatureKey[]) out[k] = stored[k] !== false;
  return out;
}

export async function featureEnabled(key: FeatureKey): Promise<boolean> {
  return (await loadFlags())[key];
}

/** For pages: hide the page completely when the feature is off. */
export async function requireFeaturePage(key: FeatureKey) {
  if (!(await featureEnabled(key))) notFound();
}

/** For server actions / routes: first line. Returns an error code to hand back to the form. */
export async function assertFeature(key: FeatureKey): Promise<"err_feature_off" | null> {
  return (await featureEnabled(key)) ? null : "err_feature_off";
}

export async function saveFlags(next: Record<FeatureKey, boolean>, userId: string): Promise<boolean> {
  const stored: Stored = {};
  for (const k of Object.keys(FEATURE_FLAGS) as FeatureKey[]) if (next[k] === false) stored[k] = false;
  return putSetting("feature_flags", stored, userId);
}
