"use client";
import { useId, type ReactNode } from "react";

import { inputCls } from "../inputStyles";
export { inputCls };

export function Field({ label, hint, children, wide = false }: { label: string; hint?: string; children: (id: string) => ReactNode; wide?: boolean }) {
  const id = useId();
  return (
    <div className={`space-y-1 ${wide ? "sm:col-span-2" : ""}`}>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export type Opt = { id: number; label: string };
export function Select({ id, name, options, defaultValue, required = true, placeholder, onChange, value, disabled }: { id?: string; name: string; options: Opt[]; defaultValue?: number | string | null; required?: boolean; placeholder: string; onChange?: (v: number | null) => void; value?: number | string; disabled?: boolean }) {
  return (
    <select id={id} name={name} required={required} disabled={disabled} className={inputCls} {...(value !== undefined ? { value } : { defaultValue: defaultValue ?? "" })} onChange={(e) => onChange?.(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}
