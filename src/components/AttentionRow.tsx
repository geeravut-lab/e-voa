"use client";
import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { openAttention } from "@/app/actions/attention";
import { Spinner } from "./Spinner";

/** One back-office alert: tapping it marks it seen, then goes to the page where the work is done. */
export function AttentionRow({ id, href, className, children }: { id: string; href: string; className: string; children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <a href={href} aria-busy={pending} className={`relative ${className}`}
      onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); if (pending) return; start(async () => { await openAttention(id); router.push(href); }); }}>
      {children}{pending && <Spinner size={18} className="text-primary" />}
    </a>
  );
}
