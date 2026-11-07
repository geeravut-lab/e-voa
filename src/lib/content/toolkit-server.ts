import "server-only";
import { getSetting } from "@/lib/settings";
import { mergeToolkit, parseToolkit, KINDS, type ToolkitContent, type ToolkitKind } from "./toolkit-store";

export const TOOLKIT_SETTING = "toolkit_content";
/** Emergency numbers, phrases and rules as the pages show them: edited in the back office when there is an edit, otherwise the built-in lists. Fails open. */
export type ToolkitLoaded = ToolkitContent & { edited: Record<ToolkitKind, boolean>; reviewed: Partial<Record<ToolkitKind, string>> };
export async function loadToolkit(): Promise<ToolkitLoaded> {
  try {
    const raw = await getSetting<unknown>(TOOLKIT_SETTING, {}), stored = parseToolkit(raw), r = ((raw && typeof raw === "object" ? (raw as { reviewed?: unknown }).reviewed : null) ?? {}) as Record<string, unknown>;
    const reviewed: Partial<Record<ToolkitKind, string>> = {};
    for (const k of KINDS) if (typeof r[k] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r[k] as string)) reviewed[k] = r[k] as string;
    return { ...mergeToolkit(stored), edited: Object.fromEntries(KINDS.map((k) => [k, !!stored[k]])) as Record<ToolkitKind, boolean>, reviewed };
  } catch (e) { console.error("[toolkit] read failed", (e as Error).message); return { ...mergeToolkit({}), edited: Object.fromEntries(KINDS.map((k) => [k, false])) as Record<ToolkitKind, boolean>, reviewed: {} }; }
}
/** The raw setting (for the editor to change one list and keep the others). */
export const loadToolkitRaw = async (): Promise<Record<string, unknown>> => { const v = await getSetting<unknown>(TOOLKIT_SETTING, {}); return v && typeof v === "object" ? { ...(v as Record<string, unknown>) } : {}; };
