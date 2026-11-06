"use client";
import { useEffect, useState } from "react";
import { useT } from "@/components/I18n";
import { Spinner } from "@/components/Spinner";
import { btnClass } from "@/components/buttonStyles";

/** "View" for an uploaded file: pictures open in a full-screen viewer, PDFs in a new tab. The file is served only to its owner (and staff) by /api/documents/[id]. */
export function DocViewer({ id, mime, label, className }: { id: string; mime: string; label: string; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false), [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false);
  const src = `/api/documents/${id}`;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);
  if (!mime.startsWith("image/")) return <a href={src} target="_blank" rel="noopener" className={className ?? btnClass("ghost")}>{t.doc_view}</a>;
  return (
    <>
      <button type="button" onClick={() => { setLoaded(false); setFailed(false); setOpen(true); }} className={className ?? btnClass("ghost")}>{t.doc_view}</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-50 flex flex-col bg-ink/90 p-3" onClick={() => setOpen(false)}>
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 pb-2 text-white">
            <p className="truncate font-semibold">{label}</p>
            <button type="button" onClick={() => setOpen(false)} className="rounded-control bg-white/15 px-4 py-2 font-semibold text-white">{t.doc_close}</button>
          </div>
          <div className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {!loaded && !failed && <Spinner size={28} className="absolute text-white" />}
            {failed ? <p className="rounded-control bg-surface p-4 text-sm font-semibold text-danger">{t.doc_view_failed}</p>
              // eslint-disable-next-line @next/next/no-img-element -- a private, decrypted file: next/image would cache and resize it
              : <img src={src} alt={label} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className="max-h-full max-w-full rounded-control object-contain" />}
          </div>
        </div>
      )}
    </>
  );
}
