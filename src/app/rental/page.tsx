import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { forLang } from "@/lib/content/types";
import { PHOTO_SLOTS, RENTAL } from "@/lib/content/rental";
import { PageHead } from "@/components/PageHead";
import { AppLink } from "@/components/AppLink";
import { RentalHelper } from "@/components/RentalHelper";
import { btnClass } from "@/components/buttonStyles";

export const generateMetadata = () => pageMeta({ path: "/rental", title: "rental_title", description: "rental_hint" });
export const dynamic = "force-dynamic";

export default async function RentalPage() {
  const { t, lang } = await getT();
  const groups = RENTAL.map((g) => ({ id: g.id, title: forLang(g.title, lang), items: g.items.map((i) => ({ id: i.id, text: forLang(i.text, lang) })) }));
  const slots = PHOTO_SLOTS.map((s) => ({ id: s.id, label: forLang(s.label, lang) }));
  return (
    <div className="space-y-4">
      <PageHead title={t.rental_title} hint={t.rental_hint} art="toolkit" tone="mint" />
      <RentalHelper groups={groups} slots={slots} />
      <div className="flex flex-wrap gap-2"><AppLink href="/incident/road-accident" className={btnClass("ghost")}>{t.tk_incident}</AppLink><AppLink href="/emergency" className={btnClass("ghost")}>{t.card_emergency}</AppLink></div>
    </div>
  );
}
