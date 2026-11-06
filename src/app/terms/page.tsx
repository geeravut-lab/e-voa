import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL_VERSION, TERMS } from "@/lib/content/legal";

export const generateMetadata = () => pageMeta({ path: "/terms", title: "terms_title", description: "seo_terms" });
export default async function TermsPage() { const { t, lang } = await getT(); return <LegalPage title={t.terms_title} sections={TERMS[lang]} version={LEGAL_VERSION} />; }
