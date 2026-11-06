"use client";
import { useRef } from "react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { uploadDocumentAction } from "@/app/actions/apply";
import { docLabel } from "@/lib/reasons";

/** One upload slot (passport page, photo, ticket …). Shows whether the file is already there; choosing a new file replaces it. */
export function DocSlot({ appId, kind, have, required }: { appId: string; kind: string; have: boolean; required: boolean }) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <ActionForm action={uploadDocumentAction} className="rounded-control border border-line bg-surface p-3">
      <input type="hidden" name="appId" value={appId} /><input type="hidden" name="kind" value={kind} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{have ? "✓" : required ? "•" : ""} {docLabel(t, kind)}{!required && <span className="font-normal text-muted"> ({t.apply_optional})</span>}</p>
        <p className={`text-xs font-semibold ${have ? "text-success" : "text-gold-deep"}`}>{have ? t.apply_doc_uploaded : t.apply_doc_missing}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input ref={ref} name="file" type="file" required accept={kind === "photo" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"} className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-control file:border-0 file:bg-sky file:px-3 file:py-2 file:font-semibold file:text-primary" aria-label={docLabel(t, kind)} />
        <SubmitButton variant="ghost">{have ? t.apply_doc_replace : t.apply_doc_upload}</SubmitButton>
      </div>
    </ActionForm>
  );
}
