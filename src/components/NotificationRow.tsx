"use client";
import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { openNotification } from "@/app/actions/account";
import { Spinner } from "./Spinner";

/** One notice. Tapping it marks it as read first, then goes to the page it points to (a spinner shows meanwhile). Middle-click / "open in new tab" still work through the real link. */
export function NotificationRow({ id, link, unread, children }: { id: string; link: string | null; unread: boolean; children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    const r = await openNotification(id);
    const to = r.link ?? link;
    if (to) router.push(to);
    else router.refresh();
  });
  const cls = "relative flex w-full items-center gap-2 text-left";
  const spin = pending ? <Spinner size={18} className="ml-auto text-primary" /> : null;
  if (!link) return unread ? <button type="button" onClick={go} disabled={pending} aria-busy={pending} className={cls}>{children}{spin}</button> : <div className={cls}>{children}</div>;
  return (
    <a href={link} aria-busy={pending} className={cls} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); if (!pending) go(); }}>
      {children}{spin}
    </a>
  );
}
