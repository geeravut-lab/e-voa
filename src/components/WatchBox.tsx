"use client";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { AppLink } from "@/components/AppLink";
import { useT } from "@/components/I18n";
import { btnClass } from "@/components/buttonStyles";
import { setWatchAction } from "@/app/actions/conditions";

/** "Tell me when the Thai Meteorological Department warns about this place": on/off for the place on screen, and the list of places already followed. */
export function WatchBox({ slug, signedIn, watched, names }: { slug: string; signedIn: boolean; watched: string[]; names: Record<string, string> }) {
  const t = useT(), on = watched.includes(slug);
  return (
    <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card" aria-label={t.cond_watch}>
      {!signedIn ? <><p className="text-sm text-muted">{t.cond_watch_signin}</p><AppLink href={`/login?next=${encodeURIComponent(`/conditions?place=${slug}`)}`} className={btnClass("primary")}>{t.nav_signin}</AppLink></> : (
        <>
          <ActionForm action={setWatchAction.bind(null, slug, !on)}><SubmitButton variant={on ? "ghost" : "primary"}>{on ? t.cond_unwatch : t.cond_watch}</SubmitButton></ActionForm>
          {on && <p className="text-sm text-muted">{t.cond_watching}</p>}
          {watched.length > 0 && (
            <div className="space-y-1"><h3 className="text-sm font-bold">{t.cond_watch_list}</h3>
              <ul className="flex flex-wrap gap-2">{watched.map((w) => (
                <li key={w} className="flex items-center gap-1 rounded-full border border-line bg-sand ps-3"><AppLink href={`/conditions?place=${w}`} className="min-h-9 text-sm font-semibold text-primary">{names[w] ?? w}</AppLink>
                  <ActionForm action={setWatchAction.bind(null, w, false)}><SubmitButton variant="ghost" className="min-h-9 px-2 text-xs" aria-label={`${t.cond_unwatch}: ${names[w] ?? w}`}>✕</SubmitButton></ActionForm></li>))}</ul></div>
          )}
        </>
      )}
    </section>
  );
}
