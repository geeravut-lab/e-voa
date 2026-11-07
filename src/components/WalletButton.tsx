"use client";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { Spinner } from "./Spinner";
import { btnClass } from "./buttonStyles";

/** A link that opens Google Wallet. The spinner shows while the browser leaves for Google (and stops again if it comes back). */
export function WalletButton({ href, children }: { href: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <a href={href} aria-busy={busy} className={btnClass("primary")} onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 6000); }}>
      {busy ? <Spinner /> : <Wallet size={18} aria-hidden="true" />}{children}
    </a>
  );
}
