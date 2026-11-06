import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { loadFlags } from "@/lib/flags";
import { safeNext } from "@/lib/safe-next";
import { getT } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";
import { LogoMark } from "@/components/Logo";
import { serverEnv } from "@/lib/env";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const [viewer, flags, { t, brand }] = await Promise.all([getViewer(), loadFlags(), getT()]);
  if (viewer.user) redirect(next);
  const { hubUrl, appSlug } = serverEnv();
  return (
    <div className="mx-auto max-w-md space-y-5 rounded-card border border-line bg-surface p-6 shadow-card">
      <div className="flex flex-col items-center gap-2 text-center">
        <LogoMark size={64} version={brand.logo?.version} />
        <h1 className="font-display text-2xl font-extrabold">{t.login_title}</h1>
        <p className="text-sm text-muted">{t.login_sub}</p>
      </div>
      {sp.error && <p role="alert" className="rounded-control bg-danger-bg p-3 text-sm font-semibold text-danger">✕ {t.login_failed}</p>}
      <LoginForm next={next} google={flags.login_google} line={flags.login_line} email={flags.login_email} hubUrl={hubUrl} appSlug={appSlug} />
      <p className="text-center text-xs text-muted">{t.login_terms}</p>
    </div>
  );
}
