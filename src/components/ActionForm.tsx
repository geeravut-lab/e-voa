"use client";
import { useActionState, type ReactNode } from "react";
import { errorText } from "@/lib/i18n/dict";
import { useT } from "./I18n";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string } | null;

/** A form wired to a server action. Shows the result in the user's language; SubmitButton children show the spinner. */
export function ActionForm({
  action,
  children,
  className = "",
  successKey = "saved",
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  successKey?: "saved" | "account_test_sent";
}) {
  const t = useT();
  const [state, formAction] = useActionState(action, null as ActionResult);
  return (
    <form action={formAction} className={className}>
      {children}
      <div aria-live="polite" className="min-h-6 text-sm">
        {state?.ok === true && <p className="font-semibold text-success">✓ {state.message ?? t[successKey]}</p>}
        {state?.ok === false && <p className="font-semibold text-danger">✕ {errorText(state.error, t)}</p>}
      </div>
    </form>
  );
}
