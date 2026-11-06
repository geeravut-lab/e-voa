"use client";
import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { AppLink } from "@/components/AppLink";
import { useT } from "@/components/I18n";
import { checkoutAction } from "@/app/actions/apply";
import { btnClass } from "@/components/buttonStyles";
import { SignaturePad } from "./SignaturePad";
import { inputCls } from "./fields";

/** The last step: what you agree to, the declaration with your signature, and Pay. Pay stays off until everything required is done. */
export function CheckoutForm({ tripId, totalLabel, hasAddons, canPay, backHref, defaultName }: { tripId: string; totalLabel: string; hasAddons: boolean; canPay: boolean; backHref: string; defaultName: string }) {
  const t = useT();
  const [terms, setTerms] = useState(false), [imm, setImm] = useState(false), [partners, setPartners] = useState(false), [decl, setDecl] = useState(false);
  const [name, setName] = useState(defaultName), [ink, setInk] = useState(false);
  const ready = canPay && terms && imm && (!hasAddons || partners) && decl && name.trim().length >= 2 && ink;
  const box = "flex items-start gap-3 rounded-control border border-line p-3 text-sm";
  return (
    <ActionForm action={checkoutAction} className="space-y-4">
      <input type="hidden" name="tripId" value={tripId} />
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.consent_title}</h2>
        <label className={box}><input type="checkbox" name="consent_terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-5 w-5" />
          <span>{t.consent_terms_a} <AppLink href="/privacy" spinner={false} className="font-semibold text-primary underline">{t.privacy_title}</AppLink> {t.consent_terms_b} <AppLink href="/terms" spinner={false} className="font-semibold text-primary underline">{t.terms_title}</AppLink>.</span></label>
        <label className={box}><input type="checkbox" name="consent_immigration" checked={imm} onChange={(e) => setImm(e.target.checked)} className="mt-1 h-5 w-5" /><span>{t.consent_immigration}</span></label>
        {hasAddons && <label className={box}><input type="checkbox" name="consent_partners" checked={partners} onChange={(e) => setPartners(e.target.checked)} className="mt-1 h-5 w-5" /><span>{t.consent_partners}</span></label>}
      </section>
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.declare_title}</h2>
        <p className="text-sm">{t.declare_text}</p>
        <label className={box}><input type="checkbox" name="declare" checked={decl} onChange={(e) => setDecl(e.target.checked)} className="mt-1 h-5 w-5" /><span>{t.declare_check}</span></label>
        <label htmlFor="signer" className="block text-sm font-semibold">{t.declare_name}</label>
        <input id="signer" name="signer_name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" className={inputCls} />
        <p className="text-sm font-semibold">{t.declare_sign}</p>
        <SignaturePad onInk={setInk} />
      </section>
      <div className="flex gap-2">
        <AppLink href={backHref} className={btnClass("ghost")}>{t.back}</AppLink>
        <SubmitButton variant="gold" className="flex-1" disabled={!ready}>{t.pay_now} · {totalLabel}</SubmitButton>
      </div>
      {!ready && canPay && <p className="text-xs text-muted">{t.consent_needed}</p>}
    </ActionForm>
  );
}
