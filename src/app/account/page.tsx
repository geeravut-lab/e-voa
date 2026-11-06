import { requireUser, displayNameOf } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { loadFlags } from "@/lib/flags";
import { sendTestNotification } from "@/app/actions/account";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { LangSwitcher } from "@/components/LangSwitcher";
import { PageHead } from "@/components/PageHead";
import { SignOutButton } from "@/components/Nav";
import { InstallApp } from "@/components/InstallApp";
import { AppLink } from "@/components/AppLink";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const v = await requireUser("/account");
  const [{ t }, flags] = await Promise.all([getT(), loadFlags()]);
  return (
    <div className="space-y-4">
      <PageHead title={t.account_title} art="account" tone="sky" />
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <p className="text-sm text-muted">{t.account_signed_in_as}</p>
        <p className="text-lg font-bold">{displayNameOf(v)}</p>
        <p className="break-all text-sm text-muted">{v.user.email}</p>
      </section>
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.account_language}</h2>
        <LangSwitcher />
      </section>
      {flags.notifications && (
        <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
          <p className="text-sm text-muted">{t.account_test_hint}</p>
          <ActionForm action={sendTestNotification} successKey="account_test_sent">
            <SubmitButton variant="ghost">{t.account_test_notice}</SubmitButton>
          </ActionForm>
        </section>
      )}
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <AppLink href="/account/password" className={btnClass("ghost", "w-full")}>{t.password_title}</AppLink>
      </section>
      <InstallApp />
      <SignOutButton />
    </div>
  );
}
