import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { AIRPORT_CODES, loadAirportNotes } from "@/lib/airports";
import { LANG_CODES, LANGS } from "@/lib/i18n/langs";
import { ARRIVAL } from "@/lib/content/guide";
import { forLang } from "@/lib/content/types";
import { saveAirportNotesAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

export default async function AdminAirports() {
  await requireAdminPage();
  const { t, lang } = await getT();
  const notes = await loadAirportNotes();
  const names = Object.fromEntries(forLang(ARRIVAL, lang).airports.map((a) => [a.h.match(/\(([A-Z]{3})\)/)?.[1] ?? "", a.h]));
  const area = "min-h-24 w-full rounded-control border-[1.5px] border-field bg-surface p-3 text-sm";
  return (
    <div>
      <PageHead title={t.admin_airports_title} hint={t.admin_airports_hint} art="guide" tone="mint" />
      <ActionForm action={saveAirportNotesAction} className="space-y-4">
        {AIRPORT_CODES.map((code) => (
          <section key={code} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="font-display text-lg font-bold">{names[code] ?? code}</h2>
            {LANG_CODES.map((l) => <label key={l} className="block space-y-1"><span className="text-sm font-semibold">{LANGS[l].native}</span><textarea name={`${code}:${l}`} defaultValue={notes[code]?.[l] ?? ""} maxLength={1500} className={area} lang={LANGS[l].htmlLang} /></label>)}
          </section>
        ))}
        <p className="text-sm text-muted">{t.admin_airports_note}</p>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
    </div>
  );
}
