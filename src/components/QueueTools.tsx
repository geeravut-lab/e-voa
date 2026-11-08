"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionForm, type ActionResult } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { Spinner } from "@/components/Spinner";
import { btnClass } from "@/components/buttonStyles";
import { inputCls } from "@/components/inputStyles";
import { useT } from "@/components/I18n";
import { errorText } from "@/lib/i18n/dict";
import { bulkOpsAction, assignAction, saveFilterAction, deleteFilterAction } from "@/app/actions/ops";
import { filterQuery, type QueueFilter } from "@/lib/ops/filters";

export const BULK_FORM = "ops-bulk";
type Person = { id: string; label: string };

/** The filters of the queue. Reloads the page with the filter in the address, so a filter can be shared and saved. */
export function QueueFilterBar({ value, people }: { value: QueueFilter; people: Person[] }) {
  const t = useT(), router = useRouter(), [pending, start] = useTransition();
  const [f, setF] = useState(value);
  const set = <K extends keyof QueueFilter>(k: K, v: QueueFilter[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(() => router.push(`/admin/queue?${filterQuery(f)}`)); }} className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card" aria-label={t.ops_filters}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1 text-sm font-semibold">{t.ops_f_search}<input value={f.q} onChange={(e) => set("q", e.target.value)} maxLength={40} className={inputCls} /></label>
        <label className="block space-y-1 text-sm font-semibold">{t.ops_f_assignee}
          <select value={f.a} onChange={(e) => set("a", e.target.value)} className={inputCls}>
            <option value="any">{t.ops_f_any}</option><option value="me">{t.ops_f_me}</option><option value="none">{t.ops_f_none}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select></label>
        <label className="block space-y-1 text-sm font-semibold">{t.ops_f_package}
          <select value={f.p} onChange={(e) => set("p", e.target.value)} className={inputCls}>
            <option value="any">{t.ops_f_pkg_any}</option><option value="regular">{t.apply_pkg_regular}</option><option value="express">{t.apply_pkg_express}</option>
          </select></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={f.late} onChange={(e) => set("late", e.target.checked)} className="h-5 w-5" />{t.ops_f_late}</label>
        <button type="submit" disabled={pending} aria-busy={pending} className={btnClass("primary")}>{pending && <Spinner />}{t.ops_f_apply}</button>
      </div>
    </form>
  );
}

/** Saves the filter that is on screen under a name. */
export function SaveFilterForm({ filter }: { filter: QueueFilter }) {
  const t = useT();
  return (
    <ActionForm action={saveFilterAction} className="flex flex-wrap items-end gap-2">
      {(["g", "q", "a", "p"] as const).map((k) => <input key={k} type="hidden" name={k} value={filter[k]} />)}
      {filter.late && <input type="hidden" name="late" value="1" />}
      <label className="block min-w-40 flex-1 space-y-1 text-sm font-semibold">{t.ops_filter_name}<input name="name" required maxLength={60} className={inputCls} /></label>
      <SubmitButton variant="ghost">{t.ops_save_filter}</SubmitButton>
    </ActionForm>
  );
}
export function DeleteFilterForm({ id, name }: { id: string; name: string }) {
  const t = useT();
  return <ActionForm action={deleteFilterAction.bind(null, id)}><SubmitButton variant="ghost" className="min-h-9 px-2 text-xs" aria-label={`${t.ops_delete_filter}: ${name}`}>{t.ops_delete}</SubmitButton></ActionForm>;
}

const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${BULK_FORM}"]`));
const ticked = () => boxes().filter((b) => b.checked).length;
/**
 * The bulk actions for the ticked applications (the ticks live on the rows, form="ops-bulk").
 * Nothing ticked: one slim row with "Select all" so the list keeps the screen.
 * Something ticked: ONE compact bar (count, action, extra field, apply) that sticks to the bottom.
 */
export function BulkBar({ people }: { people: Person[] }) {
  const t = useT();
  const [state, action] = useActionState(bulkOpsAction, null as ActionResult);
  const [op, setOp] = useState("assign_me");
  const [n, setN] = useState(0);
  useEffect(() => {
    const recount = () => setN(ticked());
    document.addEventListener("change", recount);
    return () => document.removeEventListener("change", recount);
  }, []);
  useEffect(() => { const id = setTimeout(() => setN(ticked()), 600); return () => clearTimeout(id); }, [state]);          // the list may reload after an action
  const setAll = (v: boolean) => { boxes().forEach((b) => (b.checked = v)); setN(ticked()); };
  const message = (
    <span aria-live="polite" role="status" className="min-w-0 text-sm">
      {state?.ok === true && <span className="font-semibold text-success">✓ {state.message ?? t.saved}</span>}
      {state?.ok === false && <span className="font-semibold text-danger">✕ {errorText(state.error, t)}</span>}
    </span>
  );
  const small = btnClass("ghost", "min-h-10 px-3 text-sm");
  const compactField = "min-h-10 min-w-40 flex-1 rounded-control border-[1.5px] border-field bg-surface px-3 py-1 text-base sm:w-56 sm:flex-none";
  if (n === 0) return (
    <form id={BULK_FORM} action={action} aria-label={t.ops_bulk_title} className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setAll(true)} className={small}>{t.ops_select_all}</button>
      {message}
    </form>
  );
  return (
    <form id={BULK_FORM} action={action} aria-label={t.ops_bulk_title} className="sticky bottom-20 z-10 flex flex-wrap items-center gap-2 rounded-card border border-primary bg-surface p-2 shadow-card lg:bottom-4">
      <b className="px-1 text-sm tabular">{t.ops_selected_n.replace("{n}", String(n))}</b>
      <select name="op" value={op} onChange={(e) => setOp(e.target.value)} aria-label={t.ops_bulk_op} className={compactField}>
        <option value="assign_me">{t.ops_bulk_assign_me}</option><option value="assign">{t.ops_bulk_assign}</option><option value="unassign">{t.ops_bulk_unassign}</option>
        <option value="note">{t.ops_bulk_note}</option><option value="retry">{t.ops_bulk_retry}</option>
      </select>
      {op === "assign" && <select name="assignee" required aria-label={t.ops_pick_assignee} className={compactField} defaultValue=""><option value="" disabled>{t.ops_pick_assignee}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>}
      {op === "note" && <input name="note" required maxLength={1000} aria-label={t.ops_note} placeholder={t.ops_note} className={`${"min-h-10 min-w-48 flex-1 rounded-control border-[1.5px] border-field bg-surface px-3 py-1 text-base"}`} />}
      <SubmitButton className="min-h-10 px-4 text-sm">{t.ops_bulk_apply}</SubmitButton>
      <button type="button" onClick={() => setAll(false)} className={small}>{t.ops_select_none}</button>
      {message}
    </form>
  );
}

/** On one application: who is working on it. */
export function AssignForm({ appId, current, people, meId }: { appId: string; current: string | null; people: Person[]; meId: string }) {
  const t = useT();
  return (
    <ActionForm action={assignAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="appId" value={appId} />
      <label className="block min-w-48 flex-1 space-y-1 text-sm font-semibold">{t.ops_assign_title}
        <select name="assignee" defaultValue={current ?? "none"} className={inputCls}>
          <option value="none">{t.ops_unassigned}</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.id === meId ? `${p.label} (${t.ops_f_me})` : p.label}</option>)}
        </select></label>
      <SubmitButton variant="ghost">{t.ops_assign_save}</SubmitButton>
    </ActionForm>
  );
}
