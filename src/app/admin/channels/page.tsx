import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { loadChannels } from "@/lib/channels";
import { saveChannelsAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function AdminChannels() {
  await requireAdminPage();
  const { t } = await getT();
  const c = await loadChannels();
  const f = (name: keyof typeof c, label: string, ph = "") => <label className="block space-y-1"><span className="text-sm font-semibold">{label}</span><input name={name} defaultValue={c[name]} placeholder={ph} className={inputCls} /></label>;
  return (
    <div>
      <PageHead title={t.admin_channels_title} hint={t.admin_channels_hint} art="help" tone="gold" />
      <ActionForm action={saveChannelsAction} className="space-y-4">
        {f("website", t.official_site2, "https://")}{f("line", t.official_line, "@yourlineid")}{f("email", t.official_email)}{f("phone", t.official_phone, "+66 …")}{f("hours", t.official_hours)}
        <p className="text-sm text-muted">{t.admin_channels_note}</p>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
    </div>
  );
}
