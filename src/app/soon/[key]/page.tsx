import { notFound } from "next/navigation";
import { navByKey } from "@/config/nav";
import { getT } from "@/lib/i18n/server";
import { getViewer } from "@/lib/auth";
import { fmt } from "@/lib/i18n/dict";
import { ART } from "@/components/Art";
import { NavRowLink } from "@/components/AppLink";
import { btnClass } from "@/components/buttonStyles";

export default async function SoonPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const item = navByKey(key);
  const viewer = await getViewer();
  if (!item || item.status !== "soon" || (item.area === "admin" && !viewer.isAdmin)) notFound();
  const { t } = await getT();
  return (
    <div className={`tone-${item.tone} flex flex-col items-center gap-4 rounded-card border p-6 text-center shadow-card`}>
      <div className="h-40 w-52">{item.art ? ART[item.art] : null}</div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{t.soon_title}</p>
      <h1 className="font-display text-2xl font-extrabold">{t[item.label]}</h1>
      <p className="max-w-md text-muted">{t.soon_body}</p>
      {item.phase && <span className="rounded-full bg-surface px-3 py-1 text-sm font-semibold text-primary">{fmt(t.soon_phase, { phase: item.phase })}</span>}
      <NavRowLink href="/" className={btnClass("primary")}>{t.soon_back}</NavRowLink>
    </div>
  );
}
