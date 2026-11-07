"use client";
import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { Spinner } from "./Spinner";

/** Shows a spinner while the clicked link is loading its page, so a slow tap never looks like nothing happened. */
function Pending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className={`pointer-events-none absolute end-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-surface/90 text-primary shadow ${className ?? ""}`} role="status" aria-label="Loading">
      <Spinner size={16} />
    </span>
  );
}

export function AppLink({ children, className = "", spinner = true, ...rest }: ComponentProps<typeof Link> & { spinner?: boolean }) {
  return (
    <Link {...rest} className={`relative ${className}`}>
      {children}
      {spinner && <Pending />}
    </Link>
  );
}

/** Inline variant for list/menu rows: spinner sits at the end of the row instead of floating over it. */
function InlinePending() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner size={16} className="ms-auto text-primary" /> : null;
}
export function NavRowLink({ children, className = "", ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link {...rest} className={className}>
      {children}
      <InlinePending />
    </Link>
  );
}
