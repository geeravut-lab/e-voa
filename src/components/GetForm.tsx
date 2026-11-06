"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Spinner } from "@/components/Spinner";
import { btnClass } from "@/components/buttonStyles";
import { inputCls } from "@/components/inputStyles";

/** A one-choice form that reloads the page with ?name=value (so the answer can be linked). Shows the spinner while the new page loads. */
export function GetForm({ label, name, placeholder, options, value, submit }: { label: string; name: string; placeholder: string; options: { id: number; label: string }[]; value: string; submit: string }) {
  const router = useRouter(); const [v, setV] = useState(value); const [pending, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(() => router.push(v ? `?${name}=${encodeURIComponent(v)}` : "?")); }} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
      <label className="block space-y-1"><span className="text-sm font-semibold">{label}</span>
        <select value={v} onChange={(e) => setV(e.target.value)} className={inputCls}><option value="">{placeholder}</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      <button type="submit" disabled={pending || !v} aria-busy={pending} className={btnClass("primary", "w-full")}>{pending && <Spinner />}{submit}</button>
    </form>
  );
}
