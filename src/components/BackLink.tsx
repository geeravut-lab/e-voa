"use client";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { parentOf } from "@/config/nav";
import { useT } from "./I18n";
import { NavRowLink } from "./AppLink";
import { fmt } from "@/lib/i18n/dict";

/** "Back to <parent>" at the top of every non-top-level page; the parent comes from the PARENTS table in config/nav.ts. */
export function BackLink() {
  const path = usePathname();
  const t = useT();
  const p = parentOf(path);
  if (!p) return null;
  return (
    <NavRowLink href={p.href} className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-control pe-3 text-sm font-semibold text-primary hover:underline">
      <ArrowLeft size={18} aria-hidden="true" className="rtl:rotate-180" />
      {fmt(t.nav_back_to, { page: t[p.label] })}
    </NavRowLink>
  );
}
