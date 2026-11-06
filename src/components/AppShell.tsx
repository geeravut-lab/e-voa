import { after } from "next/server";
import { Bell, LogIn } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { NAV, resolveHref, type NavItem } from "@/config/nav";
import { getViewer, displayNameOf } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { loadFlags } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/analytics";
import { attentionTotal } from "@/lib/admin-attention";
import { hasSupabase } from "@/lib/env";
import { LANGS } from "@/lib/i18n/langs";
import { I18nProvider } from "./I18n";
import { LogoMark } from "./Logo";
import { Sidebar, BottomBar, SignOutButton, type NavEntry } from "./Nav";
import { LangSwitcher } from "./LangSwitcher";
import { BackLink } from "./BackLink";
import { LiveSync } from "./LiveSync";
import { AppLink, NavRowLink } from "./AppLink";
import { btnClass } from "./buttonStyles";

async function unreadCount(): Promise<number> {
  if (!hasSupabase()) return 0;
  try {
    const { count } = await (await createClient()).from("app_notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    return count ?? 0;
  } catch (e) {
    unstable_rethrow(e);
    return 0;
  }
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const [viewer, { lang, t, brandName, brand }, flags] = await Promise.all([getViewer(), getT(), loadFlags()]);
  const signedIn = !!viewer.user;
  const isAdmin = viewer.isAdmin;
  // Staff see only the back-office menu; their bell counts what waits for them (not the traveler notices).
  const attention = isAdmin ? await attentionTotal(viewer.user!.id) : 0;
  const unread = !isAdmin && signedIn && flags.notifications ? await unreadCount() : 0;
  if (viewer.user) {
    const id = viewer.user.id;
    after(() => trackEvent(id, "active")); // once a day per person; never blocks the page
  }

  const visible = NAV.filter((n) => (!n.feature || flags[n.feature]) && n.area === (isAdmin ? "admin" : "traveler"));
  const entry = (n: NavItem): NavEntry => ({
    key: n.key,
    label: t[n.label],
    short: n.barLabel ? t[n.barLabel] : undefined,
    href: resolveHref(n, signedIn),
    icon: n.icon,
    locked: n.auth && !signedIn,
    match: n.key === "home" ? ["/"] : [n.href, `/soon/${n.key}`],
    exact: n.key === "admin_home",                          // the back-office home lights up only on its own page
    badge: n.key === "admin_notifs" ? attention : undefined,
  });
  const by = (k: string) => visible.find((n) => n.key === k);
  const side = visible.filter((n) => n.side).map(entry);
  const centreKey = isAdmin ? "ops" : "apply";
  const apply = by(centreKey) ?? NAV.find((n) => n.key === centreKey)!;
  const barKeys = isAdmin ? { left: ["admin_home", "admin_notifs"], right: ["errors"] } : { left: ["home", "trips"], right: ["help"] };
  const left = barKeys.left.map(by).filter((n): n is NavItem => !!n).map(entry);
  const right = barKeys.right.map(by).filter((n): n is NavItem => !!n).map(entry);
  const inBar = new Set([...barKeys.left, ...barKeys.right, centreKey]);
  const more = visible.filter((n) => !inBar.has(n.key) && (n.home || n.side)).map(entry);

  const name = displayNameOf(viewer);
  const bell = signedIn && (isAdmin || flags.notifications) && (
    <AppLink href={isAdmin ? "/admin/notifications" : "/notifications"} aria-label={t.nav_notifications} className="relative grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-sky">
      <Bell size={22} aria-hidden="true" />
      {(isAdmin ? attention : unread) > 0 && <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-lotus px-1 text-[11px] font-bold leading-5 text-white">{(isAdmin ? attention : unread) > 9 ? "9+" : isAdmin ? attention : unread}</span>}
    </AppLink>
  );
  const signIn = (
    <NavRowLink href="/login" className={btnClass("primary", "min-h-10 whitespace-nowrap px-4 text-sm")}><LogIn size={16} aria-hidden="true" />{t.nav_signin}</NavRowLink>
  );
  // On a phone the header is tight and the home page already has a sign-in banner: icon only.
  const signInIcon = (
    <NavRowLink href="/login" aria-label={t.nav_signin} className="grid h-11 w-11 place-items-center rounded-full bg-primary text-white"><LogIn size={20} aria-hidden="true" /></NavRowLink>
  );

  const brandRow = (
    <NavRowLink href={isAdmin ? "/admin" : "/"} className="flex items-center gap-3">
      <LogoMark size={40} version={brand.logo?.version} />
      <span className="font-display text-lg font-extrabold tracking-tight">{brandName}</span>
    </NavRowLink>
  );

  return (
    <I18nProvider t={t} lang={lang}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-white">{t.skip_to_content}</a>
      <div className="flex min-h-dvh" lang={LANGS[lang].htmlLang}>
        <Sidebar
          entries={side}
          adminLabel={t.home_section_admin}
          header={brandRow}
          footer={
            <>
              <LangSwitcher up />
              <div className="flex items-center justify-between gap-2">
                {signedIn ? (
                  <>
                    <span className="min-w-0 truncate text-sm font-semibold" title={viewer.user?.email ?? ""}>{name}</span>
                    {bell}
                  </>
                ) : signIn}
              </div>
              {signedIn && <SignOutButton />}
            </>
          }
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-bg/90 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] backdrop-blur md:hidden">
            <NavRowLink href={isAdmin ? "/admin" : "/"} className="flex min-w-0 items-center gap-2">
              <LogoMark size={32} version={brand.logo?.version} />
              <span className="truncate font-display text-base font-extrabold">{brandName}</span>
            </NavRowLink>
            <div className="flex items-center gap-1">
              {bell}
              <LangSwitcher compact />
              {!signedIn && signInIcon}
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-4 md:px-8 md:pb-12 md:pt-8">
            <BackLink />
            {children}
            <div className="mt-10 space-y-2 border-t border-line pt-4 text-xs leading-relaxed text-muted">
              <p>{t.disclaimer}</p>
              <nav aria-label={t.footer_links} className="flex flex-wrap gap-x-4 gap-y-1 font-semibold text-primary">
                <NavRowLink href="/privacy">{t.privacy_title}</NavRowLink><NavRowLink href="/terms">{t.terms_title}</NavRowLink><NavRowLink href="/fees">{t.card_fees}</NavRowLink><NavRowLink href="/help">{t.faq_title}</NavRowLink><NavRowLink href="/official">{t.official_title}</NavRowLink>
              </nav>
            </div>
          </main>
        </div>
      </div>
      <BottomBar left={left} right={right} apply={entry(apply)} more={more} unread={isAdmin ? 0 : unread} centerIcon={isAdmin ? apply.icon : undefined}>
        {signedIn ? <SignOutButton /> : <NavRowLink href="/login" className={btnClass("primary", "w-full")}><LogIn size={18} aria-hidden="true" />{t.nav_signin}</NavRowLink>}
      </BottomBar>
      {viewer.user && flags.live_sync && <LiveSync userId={viewer.user.id} isAdmin={viewer.isAdmin} />}
    </I18nProvider>
  );
}
