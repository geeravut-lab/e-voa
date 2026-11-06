"use client";
import { Printer } from "lucide-react";
import { AsyncButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";

export function PrintButton() {
  const t = useT();
  return <AsyncButton variant="ghost" onClick={() => window.print()}><Printer size={18} aria-hidden />{t.print}</AsyncButton>;
}
