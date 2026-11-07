import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { loadFees } from "@/lib/applications/service";
import { DEFAULT_REFUND_POLICY, parseRefundPolicy } from "@/lib/payments/refund-policy";
import { loadChannels } from "@/lib/channels";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { EXTRA_MAX } from "@/lib/ai/extra";
import { loadExtra } from "@/lib/ai/server";
import { savePromptExtraAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function AdminPrompts() {
  await requireAdminPage();
  const { t, lang } = await getT();
  const [extra, fees, policy, ch, { data: versions }] = await Promise.all([loadExtra(), loadFees(), getSetting<unknown>("refund_policy", DEFAULT_REFUND_POLICY).then(parseRefundPolicy), loadChannels(),
    createAdminClient().from("ai_prompt_versions").select("id, body, created_at").eq("task", "chat").order("created_at", { ascending: false }).limit(10)]);
  // the same builder the assistant uses, so what is shown here is what it really receives
  const builtin = buildSystemPrompt({ fees: { visa: fees.visa_thb, regular: fees.regular_service_thb, express: fees.express_service_thb }, refund: { visa: policy.visa_fee_refundable, addons: policy.unused_addons_refundable }, lang,
    channels: [ch.website, ch.line && `LINE ${ch.line}`, ch.email, ch.phone, ch.hours].filter(Boolean).join("; ") });
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_prompts_title} hint={t.admin_prompts_hint} art="prompts" tone="gold" />
      <ActionForm action={savePromptExtraAction} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <div><h2 className="font-display text-lg font-bold">{t.prompts_extra}</h2><p className="text-xs text-muted">{t.prompts_extra_hint}</p></div>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="enabled" defaultChecked={extra.chat.enabled} className="mt-1 h-5 w-5" /><span>{t.prompts_enabled}</span></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t.prompts_text}</span>
          <textarea name="text" rows={7} maxLength={EXTRA_MAX} defaultValue={extra.chat.text} className={`${inputCls} text-sm`} /></label>
        <p className="text-xs text-muted">{t.prompts_checked}</p>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
      <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.prompts_builtin}</h2><p className="text-xs text-muted">{t.prompts_builtin_hint}</p>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-card bg-sand p-3 text-xs" tabIndex={0}>{builtin}</pre>
        <p className="text-xs text-muted">{t.prompts_review_locked}</p>
      </section>
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-2 font-display text-lg font-bold">{t.prompts_history}</h2>
        {versions?.length ? <ul className="space-y-2 text-xs">{versions.map((v) => <li key={v.id} className="border-t border-line pt-2"><span className="text-muted tabular">{new Date(v.created_at).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })}</span><p className="whitespace-pre-wrap">{v.body || t.prompts_empty_version}</p></li>)}</ul> : <p className="text-sm text-muted">{t.prompts_history_none}</p>}
      </section>
    </div>
  );
}
