"use client";
import { useState } from "react";
import { AsyncButton } from "./Buttons";
import { errorText } from "@/lib/i18n/dict";
import { useT } from "./I18n";
import { testAiModelAction } from "@/app/actions/admin";

/** Asks the chosen provider and model for real. The model name is read from the list (or the box for another name) next to it, so an unsaved change can be tried before saving. */
export function AiTestButton({ provider, field, fallbackModel }: { provider: string; field: string; fallbackModel: string }) {
  const t = useT();
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <AsyncButton variant="ghost" onClick={async () => {
        const custom = document.querySelector<HTMLInputElement>(`input[name="${field}__custom"]`)?.value.trim();           // a typed name wins over the list
        const picked = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${field}"]`)?.value;
        const r = await testAiModelAction(provider, (custom || picked || fallbackModel).trim());
        setRes(r?.ok ? { ok: true, text: r.message ?? "✓" } : { ok: false, text: errorText(r && !r.ok ? r.error : "err_generic", t) });
      }}>{t.ai_test}</AsyncButton>
      {res && <span role="status" className={`text-xs font-semibold ${res.ok ? "text-success" : "text-danger"}`}>{res.ok ? res.text : `✕ ${res.text}`}</span>}
    </span>
  );
}
