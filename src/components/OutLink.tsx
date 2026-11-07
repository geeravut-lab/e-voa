"use client";
import { useState, type ReactNode } from "react";
import { Spinner } from "./Spinner";
import { btnClass } from "./buttonStyles";

/** A link to another app or site (LINE, Wallet …). The spinner shows while the phone switches away and stops again if the person comes back. */
export function OutLink({ href, children, icon, variant = "primary" }: { href: string; children: ReactNode; icon?: ReactNode; variant?: "primary" | "gold" | "ghost" }) {
  const [busy, setBusy] = useState(false);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-busy={busy} className={btnClass(variant)} onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 5000); }}>
      {busy ? <Spinner /> : icon}{children}
    </a>
  );
}
