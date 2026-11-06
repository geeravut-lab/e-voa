import "server-only";
import { hasServiceRole } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The only writer of in-app notifications. Inserting a row also wakes the user's open pages (database trigger → live ping).
 * `dedupeKey` makes one event notify once even if the code path runs again. Never throws.
 */
export async function notifyUser(n: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
  kind?: string;
  dedupeKey?: string;
}): Promise<boolean> {
  if (!hasServiceRole()) return false;
  try {
    const { error } = await createAdminClient().from("app_notifications").insert({
      user_id: n.userId,
      title: n.title.slice(0, 120),
      body: n.body?.slice(0, 400) ?? null,
      link: n.link ?? null,
      kind: n.kind ?? "info",
      dedupe_key: n.dedupeKey ?? null,
    });
    if (error && error.code !== "23505") {
      console.error("[notify] insert failed", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[notify] insert failed", (e as Error).message);
    return false;
  }
}
