import type { Dict } from "@/lib/i18n/dict";

/** The four steps of the application. Done steps are filled, the current one is highlighted. */
export function Stepper({ step, t }: { step: number; t: Dict }) {
  const names = [t.step_package, t.step_documents, t.step_extras, t.step_pay];
  return (
    <ol className="mb-5 grid grid-cols-4 gap-1 text-center" aria-label={t.card_apply}>
      {names.map((n, i) => {
        const k = i + 1, state = k < step ? "done" : k === step ? "now" : "next";
        return (
          <li key={n} aria-current={state === "now" ? "step" : undefined} className="min-w-0">
            <span className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold ${state === "done" ? "bg-success text-white" : state === "now" ? "bg-primary text-white" : "bg-sky text-muted"}`}>{state === "done" ? "✓" : k}</span>
            <span className={`mt-1 block truncate text-xs font-semibold ${state === "next" ? "text-muted" : "text-ink"}`}>{n}</span>
          </li>
        );
      })}
    </ol>
  );
}
