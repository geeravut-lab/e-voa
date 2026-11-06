"use client";
import { AsyncButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";

/** Shown when a page fails on the server. Says what to do instead of a bare error; the owner is pointed to /api/health (which variable is missing). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="mx-auto max-w-md space-y-4 rounded-card border border-line bg-surface p-6 text-center shadow-card">
      <h1 className="font-display text-2xl font-extrabold">{t.err_page_title}</h1>
      <p className="text-sm text-muted">{t.err_page_hint}</p>
      <AsyncButton className="w-full" onClick={() => reset()}>{t.err_page_reload}</AsyncButton>
      <p className="text-xs text-muted">{t.err_page_owner}</p>
      {error.digest && <p className="font-mono text-xs text-muted">ref {error.digest}</p>}
    </div>
  );
}
