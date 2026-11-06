import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL_VERSION, PRIVACY } from "@/lib/content/legal";

export const metadata: Metadata = { title: "Privacy notice" };
export default async function PrivacyPage() { const { t, lang } = await getT(); return <LegalPage title={t.privacy_title} sections={PRIVACY[lang]} version={LEGAL_VERSION} />; }
