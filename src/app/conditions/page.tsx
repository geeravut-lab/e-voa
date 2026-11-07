import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { forLang } from "@/lib/content/types";
import { PLACES, findPlace } from "@/lib/conditions/places";
import { ADVICE, ADVICE_NOTE, advise, airLevel, uvBand, weatherGroup } from "@/lib/conditions/rules";
import { AIR_LABEL, UV_LABEL, WEATHER_LABEL } from "@/lib/conditions/labels";
import { fetchConditions, SOURCE } from "@/lib/conditions/service";
import { warningLevel } from "@/lib/conditions/tmd";
import { limited } from "@/lib/ratelimit";
import { PageHead } from "@/components/PageHead";
import { AppLink } from "@/components/AppLink";
import { PlacePicker } from "@/components/PlacePicker";
import { WatchBox } from "@/components/WatchBox";
import { getViewer } from "@/lib/auth";
import { listWatches } from "@/lib/conditions/watch";
import { btnClass } from "@/components/buttonStyles";

export const generateMetadata = () => pageMeta({ path: "/conditions", title: "cond_title", description: "cond_hint" });
export const dynamic = "force-dynamic";
const TONE = { info: "border-sky-line bg-sky text-primary", caution: "border-gold bg-gold-soft text-gold-deep", warning: "border-danger bg-danger-bg text-danger" } as const;

export default async function ConditionsPage({ searchParams }: { searchParams: Promise<{ place?: string }> }) {
  const { t, lang } = await getT();
  const place = findPlace((await searchParams).place) ?? PLACES[0];
  const cond = (await limited("conditions", 60, 600)) ? ({ ok: false } as const) : await fetchConditions(place);       // the cache keeps repeated views from calling the weather service
  const viewer = await getViewer(), watched = viewer.user ? await listWatches(viewer.user.id) : [];
  const ok = cond.ok ? cond : null, r = ok ? ok.readings : null, hasNumbers = !!r && (r.tempC !== null || r.pm25 !== null);
  const box = "space-y-2 rounded-card border border-line bg-surface p-5 shadow-card";
  const num = (v: number | null | undefined, unit = "") => (v === null || v === undefined ? "—" : `${Math.round(v * 10) / 10}${unit}`);
  const wg = r ? weatherGroup(r.weatherCode) : null, air = r ? airLevel(r.pm25) : null, uv = r ? uvBand(r.uvNow ?? r.uvMax) : null, advice = r ? advise(r) : [];
  return (
    <div className="space-y-4">
      <PageHead title={t.cond_title} hint={t.cond_hint} art="toolkit" tone="sky" />
      <PlacePicker current={place.slug} lang={lang} />
      {!r || !hasNumbers ? <p role="alert" className="rounded-card border border-gold bg-gold-soft p-5 font-semibold text-gold-deep">{t.cond_unavailable}</p> : null}
      {ok?.warningsKnown && (
            <section className={box} aria-label={t.cond_warnings}>
              <h2 className="font-display text-lg font-bold">{t.cond_warnings}</h2>
              {ok.warnings.length === 0 ? <p className="text-sm text-muted">{t.cond_no_warnings}</p> : (
                <>
                  <ul className="space-y-2">{ok.warnings.map((w) => (
                    <li key={w.id} className={`space-y-1 rounded-control border p-3 text-sm ${TONE[warningLevel(w.severity)]}`}>
                      <b className="block" lang="th">{w.headline || w.event}{w.expires ? ` · ${t.cond_warn_until.replace("{time}", w.expires.slice(0, 16).replace("T", " "))}` : ""}</b>
                      <span className="block font-normal text-ink" lang="th">{w.description}</span>{w.instruction && <span className="block font-semibold text-ink" lang="th">{w.instruction}</span>}
                    </li>))}</ul>
                  <p className="text-xs text-muted">{t.cond_warning_note}</p>
                </>
              )}
            </section>
          )}
      {r && hasNumbers && (
        <>
          <section className={box} aria-label={t.cond_now}>
            <h2 className="font-display text-lg font-bold">{t.cond_now} · {forLang(place.name, lang)}</h2>
            <p className="font-display text-4xl font-extrabold tabular">{num(r.tempC, "°C")} <span className="text-base font-semibold text-muted">{wg ? forLang(WEATHER_LABEL[wg], lang) : ""}</span></p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-muted">{t.cond_feels}</dt><dd className="font-semibold tabular">{num(r.feelsC, "°C")}</dd></div>
              <div><dt className="text-xs text-muted">{t.cond_humidity}</dt><dd className="font-semibold tabular">{num(r.humidity, "%")}</dd></div>
              <div><dt className="text-xs text-muted">{t.cond_wind}</dt><dd className="font-semibold tabular">{num(r.windKmh, " km/h")}</dd></div>
              <div><dt className="text-xs text-muted">{t.cond_max}</dt><dd className="font-semibold tabular">{num(r.tempMaxC, "°C")}</dd></div>
              <div><dt className="text-xs text-muted">{t.cond_rain_prob}</dt><dd className="font-semibold tabular">{num(r.rainProbMax, "%")}</dd></div>
              <div><dt className="text-xs text-muted">{t.cond_uv}</dt><dd className="font-semibold tabular">{num(r.uvNow ?? r.uvMax)}{uv ? ` · ${forLang(UV_LABEL[uv], lang)}` : ""}</dd></div>
            </dl>
          </section>
          <section className={box} aria-label={t.cond_air}>
            <h2 className="font-display text-lg font-bold">{t.cond_air}</h2>
            <p className="font-display text-3xl font-extrabold tabular">{num(r.pm25)} <span className="text-base font-semibold text-muted">µg/m³</span></p>
            {air && <p className="font-semibold">{forLang(AIR_LABEL[air], lang)}{ok!.air.source === "air4thai" ? (ok!.air.station.thaiAqi !== null ? ` · Thai AQI ${Math.round(ok!.air.station.thaiAqi)}` : "") : r.usAqi !== null ? ` · US AQI ${Math.round(r.usAqi)}` : ""}</p>}
            <p className="text-xs text-muted">{ok!.air.source === "air4thai" ? t.cond_air_station.replace("{station}", ok!.air.station.name).replace("{km}", String(ok!.air.station.distanceKm)).replace("{time}", ok!.air.station.at?.replace("T", " ") ?? "—") : t.cond_air_model}</p>
          </section>
          <section className={box} aria-label={t.cond_advice}>
            <h2 className="font-display text-lg font-bold">{t.cond_advice}</h2>
            {advice.length === 0 ? <p className="text-sm text-muted">{t.cond_nothing}</p> : <ul className="space-y-2">{advice.map((a) => <li key={a.key} className={`rounded-control border p-3 text-sm font-semibold ${TONE[a.level]}`}>{forLang(ADVICE[a.key], lang)}</li>)}</ul>}
          </section>
          <p className="text-xs text-muted">{r.time ? t.cond_updated.replace("{time}", r.time.replace("T", " ")) : ""}</p>
        </>
      )}
      <WatchBox slug={place.slug} signedIn={!!viewer.user} watched={watched} names={Object.fromEntries(PLACES.map((p) => [p.slug, forLang(p.name, lang)]))} />
      <p className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{forLang(ADVICE_NOTE, lang)}</p>
      <div className="flex flex-wrap gap-2">
        <AppLink href="/help/chat" className={btnClass("primary")}>{t.cond_ask_ai}</AppLink>
        <AppLink href="/emergency" className={btnClass("ghost")}>{t.card_emergency}</AppLink>
      </div>
      <p className="text-xs text-muted">{t.cond_source} · {t.cond_source_air} · {t.cond_source_tmd}{SOURCE ? "" : ""}</p>
    </div>
  );
}
