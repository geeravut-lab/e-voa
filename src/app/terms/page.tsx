import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL_VERSION, TERMS } from "@/lib/content/legal";

export const metadata: Metadata = { title: "Terms of service" };
export default async function TermsPage() { const { t, lang } = await getT(); return <LegalPage title={t.terms_title} sections={TERMS[lang]} version={LEGAL_VERSION} />; }
