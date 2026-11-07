import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL_VERSION, PRIVACY } from "@/lib/content/legal";
import { forLang } from "@/lib/content/types";

export const generateMetadata = () => pageMeta({ path: "/privacy", title: "privacy_title", description: "seo_privacy" });
export default async function PrivacyPage() { const { t, lang } = await getT(); return <LegalPage title={t.privacy_title} sections={forLang(PRIVACY, lang)} version={LEGAL_VERSION} />; }
