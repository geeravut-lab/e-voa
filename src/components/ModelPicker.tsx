"use client";
import { inputCls } from "@/components/inputStyles";
import { useT } from "@/components/I18n";
import { AiTestButton } from "@/components/AiTestButton";

/**
 * The model of one provider for one task: a list of EVERY model the provider offers right now (a text box with suggestions only shows the entries that match what is already typed,
 * which looked like "just one model"), plus a box for a name that is not in the list. When the list could not be read, only the box is shown.
 */
export function ModelPicker({ provider, label, field, current, models }: { provider: string; label: string; field: string; current: string; models: string[] | null }) {
  const t = useT();
  const list = models ? [...new Set(models)].sort((a, b) => b.localeCompare(a, "en", { numeric: true })) : null;
  const missing = !!list && !!current && !list.includes(current);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block w-full min-w-0 flex-1 space-y-1 sm:w-auto"><span className="text-xs font-semibold text-muted">{label}{list ? ` · ${t.ai_model_for_count.replace("{n}", String(list.length))}` : ""}</span>
          {list ? (
            <select name={field} defaultValue={current} className={`${inputCls} font-mono`}>
              {missing && <option value={current}>{t.ai_model_for_missing.replace("{model}", current)}</option>}
              {list.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : <input name={field} defaultValue={current} className={`${inputCls} font-mono`} autoComplete="off" spellCheck={false} />}
        </label>
        <AiTestButton provider={provider} field={field} fallbackModel={current} />
      </div>
      {list ? <label className="block space-y-1"><span className="text-xs text-muted">{t.ai_model_for_other}</span>
        <input name={`${field}__custom`} defaultValue="" className={`${inputCls} font-mono`} autoComplete="off" spellCheck={false} /></label> : <p className="text-xs text-muted">{t.ai_model_for_none}</p>}
    </div>
  );
}
