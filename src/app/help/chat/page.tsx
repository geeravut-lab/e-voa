import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { featureEnabled } from "@/lib/flags";
import { aiConfigured, loadAi } from "@/lib/ai/settings";
import { pageMeta } from "@/lib/seo";
import { ChatBox } from "@/components/ChatBox";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";
export const generateMetadata = () => pageMeta({ path: "/help/chat", title: "ai_title", description: "seo_ai" });

export default async function ChatPage() {
  if (!(await featureEnabled("ai_assistant")) || !aiConfigured() || !(await loadAi()).enabled) notFound();
  const { t } = await getT();
  return (
    <div className="space-y-4">
      <PageHead title={t.ai_title} hint={t.ai_hint} art="help" tone="sky" />
      <ChatBox suggestions={[t.ai_s1, t.ai_s2, t.ai_s3]} />
    </div>
  );
}
