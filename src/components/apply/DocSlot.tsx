"use client";
import { useRef, useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { uploadDocumentAction } from "@/app/actions/apply";
import { docLabel } from "@/lib/reasons";
import { checkFace, type FaceWarning } from "@/lib/face-check";
import { Spinner } from "@/components/Spinner";
import { DocViewer } from "./DocViewer";
import { SelfieCamera } from "./SelfieCamera";
import { btnClass } from "@/components/buttonStyles";

/** One upload slot (passport page, photo, ticket …). Shows whether the file is already there; choosing a new file replaces it. */
export function DocSlot({ appId, kind, have, required, file }: { appId: string; kind: string; have: boolean; required: boolean; file?: { id: string; mime: string } }) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [face, setFace] = useState<FaceWarning[] | null>(null), [checking, setChecking] = useState(false), [cam, setCam] = useState(false);
  const fallback = useRef<HTMLInputElement>(null);          // phones without getUserMedia: the system camera through a file input
  const give = (f: File) => {                               // put a captured / fallback picture into the form's file input, then run the same face check
    const dt = new DataTransfer(); dt.items.add(f); if (ref.current) ref.current.files = dt.files; void onPick(f);
  };
  const onPick = async (f: File | undefined) => {                  // face advice appears as soon as a photo is chosen, before it is sent
    setFace(null); if (kind !== "photo" || !f || !f.type.startsWith("image/")) return;
    setChecking(true); setFace(await checkFace(f)); setChecking(false);
  };
  return (
    <>
    <ActionForm action={uploadDocumentAction} className="rounded-control border border-line bg-surface p-3">
      <input type="hidden" name="appId" value={appId} /><input type="hidden" name="kind" value={kind} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{have ? "✓" : required ? "•" : ""} {docLabel(t, kind)}{!required && <span className="font-normal text-muted"> ({t.apply_optional})</span>}</p>
        <p className={`text-xs font-semibold ${have ? "text-success" : "text-gold-deep"}`}>{have ? t.apply_doc_uploaded : t.apply_doc_missing}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input ref={ref} name="file" type="file" required accept={kind === "photo" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"} onChange={(e) => onPick(e.target.files?.[0])} className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-control file:border-0 file:bg-sky file:px-3 file:py-2 file:font-semibold file:text-primary" aria-label={docLabel(t, kind)} />
        <SubmitButton variant="ghost">{have ? t.apply_doc_replace : t.apply_doc_upload}</SubmitButton>
      </div>
      {(file || kind === "photo") && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {file && <DocViewer id={file.id} mime={file.mime} label={docLabel(t, kind)} />}
          {kind === "photo" && (
            <button type="button" onClick={() => (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function" ? setCam(true) : fallback.current?.click())} className={btnClass("ghost")}>📷 {t.photo_selfie}</button>
          )}
        </div>
      )}
      {cam && <SelfieCamera onCapture={give} onClose={() => setCam(false)} />}
      {kind === "photo" && (checking || face) && (
        <p role="status" className={`mt-2 rounded-control p-2 text-sm font-semibold ${!checking && face?.length === 0 ? "bg-mint text-teal-deep" : "bg-gold-soft text-gold-deep"}`}>
          {checking ? <><Spinner size={14} className="me-1 inline" />{t.photo_checking}</> : face?.length === 0 ? `✓ ${t.photo_f_ok}` : `${t.photo_advice}: ${face?.map((w) => (t as unknown as Record<string, string>)[`photo_f_${w}`]).join(" ")}`}
        </p>
      )}
    </ActionForm>
    {/* outside the form on purpose: it only hands the picture over to the form's own file input */}
    {kind === "photo" && <input ref={fallback} type="file" accept="image/*" capture="user" hidden tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) give(f); e.target.value = ""; }} />}
    </>
  );
}
