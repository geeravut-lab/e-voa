"use server";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth";
import { markAttentionSeen } from "@/lib/admin-attention";
import type { ActionResult } from "@/components/ActionForm";

/** Opening one alert marks it seen for this administrator (the bell count drops). The alert stays in the list until the work is done. */
export async function openAttention(key: string): Promise<void> {
  const a = await requireAdminAction(); if (!a.ok) return;
  if (!/^[a-z0-9_]{3,40}$/.test(key)) return;
  await markAttentionSeen(a.viewer.user.id, key);
  revalidatePath("/", "layout");
}
export async function markAllAttentionSeen(): Promise<ActionResult> {
  const a = await requireAdminAction(); if (!a.ok) return a;
  await markAttentionSeen(a.viewer.user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}
