import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { loadChannels } from "@/lib/channels";
import { SITE_URL } from "@/lib/env";
import { PageHead } from "@/components/PageHead";
import { lineHref, telHref } from "@/lib/channel-links";

export const generateMetadata = () => pageMeta({ path: "/official", title: "official_title", description: "seo_official" });
export const dynamic = "force-dynamic";

export default async function OfficialPage() {
  const { t, brandName } = await getT();
  const c = await loadChannels();
  const rows: [string, string, (string | null)?][] = [[t.official_site, new URL(SITE_URL).host, SITE_URL], ...(c.website ? [[t.official_site2, c.website.replace(/^https:\/\//, ""), c.website] as [string, string, string]] : []), ...(c.line ? [[t.official_line, c.line, lineHref(c.line)] as [string, string, string | null]] : []), ...(c.email ? [[t.official_email, c.email, `mailto:${c.email}`] as [string, string, string]] : []), ...(c.phone ? [[t.official_phone, c.phone, telHref(c.phone)] as [string, string, string | null]] : []), ...(c.hours ? [[t.official_hours, c.hours] as [string, string]] : [])];
  return (
    <div className="space-y-4">
      <PageHead title={t.official_title} hint={t.official_hint} art="help" tone="gold" />
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{brandName}</h2>
        <dl className="space-y-2">{rows.map(([k, v, href]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="break-all font-semibold">{href ? <a href={href} className="text-primary underline" {...(href.startsWith("https://line.me/") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{v}</a> : v}</dd></div>)}</dl>
        {rows.length === 1 && <p className="text-sm text-muted">{t.official_more_soon}</p>}
      </section>
      <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.official_warn_title}</h2>
        <ul className="list-disc space-y-1 ps-5 text-[15px]">{[t.official_warn_1, t.official_warn_2, t.official_warn_3, t.official_warn_4].map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
    </div>
  );
}
