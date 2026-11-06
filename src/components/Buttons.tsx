"use client";
import { useFormStatus } from "react-dom";
import { useState, useTransition, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Spinner } from "./Spinner";
import { btnClass, type Variant } from "./buttonStyles";

/** Submit button for <form action={...}>: spinner and disabled while the server action runs. */
export function SubmitButton({ children, variant = "primary", className = "", ...rest }: { children: ReactNode; variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} type="submit" disabled={pending || rest.disabled} aria-busy={pending} className={btnClass(variant, className)}>
      {pending && <Spinner />}
      {children}
    </button>
  );
}

/** Button whose onClick may be async: shows the spinner until it settles and ignores repeat clicks meanwhile. */
export function AsyncButton({
  children,
  onClick,
  variant = "primary",
  className = "",
  ...rest
}: { children: ReactNode; variant?: Variant; onClick: () => void | Promise<void> } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pending = busy || isPending;
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      disabled={pending || rest.disabled}
      aria-busy={pending}
      className={btnClass(variant, className)}
      onClick={() => {
        if (pending) return;
        setBusy(true);
        startTransition(async () => {
          try {
            await onClick();
          } finally {
            setBusy(false);
          }
        });
      }}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}
