import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { PageHead } from "@/components/PageHead";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

/** Set or change the password (also where the "forgot password" e-mail link lands). Works for accounts made with Google or LINE too. */
export default async function PasswordPage() {
  await requireUser("/account/password");
  const { t } = await getT();
  return (
    <div className="space-y-4">
      <PageHead title={t.password_title} hint={t.password_hint} art="account" tone="sky" />
      <PasswordForm />
    </div>
  );
}
