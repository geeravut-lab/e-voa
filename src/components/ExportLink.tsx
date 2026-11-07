"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { Spinner } from "./Spinner";
import { btnClass } from "./buttonStyles";

/** A download link that shows a spinner while the file is being prepared (the browser starts the download, then the spinner stops). */
export function ExportLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "ghost" }) {
  const [busy, setBusy] = useState(false);
  return (
    <a href={href} download aria-busy={busy} className={btnClass(variant, "min-h-10 px-4")} onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 2500); }}>
      {busy ? <Spinner /> : <Download size={18} aria-hidden="true" />}{children}
    </a>
  );
}
