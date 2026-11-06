"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Lock, LogOut, MoreHorizontal, Plane, X } from "lucide-react";
import type { IconName } from "@/config/nav";
import { signOutAction } from "@/app/actions/session";
import { NavIcon } from "./NavIcon";
import { NavRowLink } from "./AppLink";
import { Spinner } from "./Spinner";
import { LangSwitcher } from "./LangSwitcher";
import { SubmitButton } from "./Buttons";
import { useT } from "./I18n";

// `exact`: the entry is active only on its own page (the back-office home must not light up on every page below it).
// `groupHead`: the entry is the title of a group in the More sheet (the back-office group), drawn differently from ordinary rows.
export type NavEntry = { key: string; label: string; short?: string; href: string; icon: IconName; locked: boolean; match: string[]; section?: "admin"; exact?: boolean; groupHead?: boolean; badge?: number };

const isActive = (path: string, e: NavEntry) => e.match.some((m) => (m === "/" || e.exact ? path === m : path === m || path.startsWith(m + "/")));

function Row({ e, active, onNavigate }: { e: NavEntry; active: boolean; onNavigate?: () => void }) {
  return (
    <NavRowLink
      href={e.href}
      onNavigate={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] font-semibold transition ${
        active ? "bg-sky text-primary" : "text-ink hover:bg-sky/70"
      }`}
    >
      <NavIcon name={e.icon} size={20} />
      <span className="truncate">{e.label}</span>
      {!!e.badge && <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-lotus px-1.5 text-[11px] font-bold leading-5 text-white">{e.badge > 99 ? "99+" : e.badge}</span>}
      {e.locked && <Lock size={14} className="ml-auto text-muted" aria-hidden="true" />}
    </NavRowLink>
  );
}

/** Desktop sidebar: full height, sticky; only the middle list scrolls. */
export function Sidebar({ entries, header, footer, adminLabel }: { entries: NavEntry[]; header: React.ReactNode; footer: React.ReactNode; adminLabel: string }) {
  const path = usePathname();
  const main = entries.filter((e) => e.section !== "admin");
  const admin = entries.filter((e) => e.section === "admin");
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="p-4">{header}</div>
      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-3" aria-label="Main">
        {main.map((e) => <Row key={e.key} e={e} active={isActive(path, e)} />)}
        {admin.length > 0 && <p className="px-3 pb-1 pt-4 text-xs font-bold uppercase tracking-wider text-muted">{adminLabel}</p>}
        {admin.map((e) => <Row key={e.key} e={e} active={isActive(path, e)} />)}
      </nav>
      <div className="space-y-3 border-t border-line p-4">{footer}</div>
    </aside>
  );
}

/** Mobile bottom bar: 4 fixed entries + a raised centre "Apply" button + "More". */
export function BottomBar({ left, right, apply, more, unread, centerIcon, children }: { left: NavEntry[]; right: NavEntry[]; apply: NavEntry; more: NavEntry[]; unread: number; centerIcon?: IconName; children?: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [navTo, setNavTo] = useState<string | null>(null);
  const navRef = useRef<string | null>(null);

  // The device Back button closes the sheet instead of leaving the page: the sheet reserves one history entry while open.
  // Tapping a link inside the sheet first steps back over that entry, THEN navigates, so one Back press returns to the page that opened it.
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ evoaSheet: true }, "");
    const onPop = () => {
      if (navRef.current) router.push(navRef.current);   // sheet stays open (with a spinner) until the new page arrives
      else setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (window.history.state?.evoaSheet) window.history.back();
    };
  }, [open, router]);

  // New page arrived: close the sheet.
  useEffect(() => { navRef.current = null; setNavTo(null); setOpen(false); }, [path]);

  const closeSheet = () => (window.history.state?.evoaSheet ? window.history.back() : setOpen(false));
  const goFromSheet = (href: string) => {
    if (navRef.current) return;               // ignore double taps
    navRef.current = href; setNavTo(href);
    if (window.history.state?.evoaSheet) window.history.back(); else router.push(href);
  };

  const tab = (e: NavEntry) => {
    const active = isActive(path, e);
    return (
      <NavRowLink key={e.key} href={e.href} aria-current={active ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold ${active ? "text-primary" : "text-muted"}`}>
        <span className="relative"><NavIcon name={e.icon} size={22} />{!!e.badge && <span className="absolute -right-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-lotus px-1 text-[10px] font-bold leading-4 text-white">{e.badge > 9 ? "9+" : e.badge}</span>}</span>
        <span className="max-w-full truncate px-1">{e.short ?? e.label}</span>
      </NavRowLink>
    );
  };
  const applyActive = isActive(path, apply);
  const moreActive = more.some((e) => isActive(path, e));   // the current page is one of the sheet's pages
  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 items-end px-1">
          {left.map(tab)}
          <NavRowLink href={apply.href} aria-label={apply.label} aria-current={applyActive ? "page" : undefined}
            className={`relative -mt-6 flex flex-col items-center gap-0.5 pb-1 text-[12px] font-bold ${applyActive ? "text-primary" : "text-ink"}`}>
            <span className="pressable grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-teal to-primary text-white shadow-[0_10px_20px_-6px_rgb(21_87_224/0.6)] ring-4 ring-surface">
              {centerIcon ? <NavIcon name={centerIcon} size={28} /> : <Plane size={28} aria-hidden="true" />}
            </span>
            <span>{centerIcon ? (apply.short ?? apply.label) : t.nav_apply}</span>
          </NavRowLink>
          {right.map(tab)}
          <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-current={moreActive ? "page" : undefined}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold ${moreActive ? "text-primary" : "text-muted"}`}>
            <MoreHorizontal size={22} aria-hidden="true" />
            <span>{t.nav_more}</span>
            {unread > 0 && <span className="absolute right-[22%] top-1.5 h-2.5 w-2.5 rounded-full bg-lotus ring-2 ring-surface" />}
          </button>
        </div>
      </nav>
      {open && <MoreSheet entries={more} onClose={closeSheet} onGo={goFromSheet} navTo={navTo}>{children}</MoreSheet>}
    </>
  );
}

function MoreSheet({ entries, onClose, onGo, navTo, children }: { entries: NavEntry[]; onClose: () => void; onGo: (href: string) => void; navTo: string | null; children?: React.ReactNode }) {
  const t = useT();
  const path = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  const measure = () => {
    const el = box.current;
    if (!el) return;
    setCanUp(el.scrollTop > 4);
    setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  };
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "center" });   // open with the current page in view
    measure();
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scrollBy = (dir: 1 | -1) => box.current?.scrollBy({ top: dir * box.current.clientHeight * 0.6, behavior: "smooth" });

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label={t.nav_more}>
      <button type="button" aria-label={t.nav_close} onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-3xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <span className="font-display text-lg font-bold">{t.nav_more}</span>
          <button type="button" onClick={onClose} aria-label={t.nav_close} className="grid h-11 w-11 place-items-center rounded-full hover:bg-sky"><X size={22} /></button>
        </div>
        <div className="relative min-h-0 flex-1">
          <div ref={box} onScroll={measure} className="max-h-[calc(85dvh-4rem)] space-y-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {entries.map((e) => {
              const active = isActive(path, e);
              const loading = navTo === e.href;
              return (
                <button key={e.key} type="button" disabled={!!navTo} aria-current={active ? "page" : undefined} aria-busy={loading} onClick={() => onGo(e.href)}
                  className={e.groupHead
                    ? `mt-3 flex min-h-11 w-full items-center gap-3 rounded-control border px-3 text-left text-[13px] font-extrabold uppercase tracking-wider transition ${active ? "border-primary bg-sky text-primary" : "border-gold bg-gold-soft text-gold-deep"}`
                    : `flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-[15px] font-semibold transition ${e.section === "admin" ? "ml-3 w-[calc(100%-0.75rem)] rounded-l-none border-l-2 border-gold" : ""} ${active ? "bg-sky text-primary" : "text-ink hover:bg-sky/70"}`}>
                  <NavIcon name={e.icon} size={20} />
                  <span className="truncate">{e.label}</span>
                  {loading ? <Spinner size={16} className="ml-auto text-primary" /> : e.locked ? <Lock size={14} className="ml-auto text-muted" aria-hidden="true" /> : null}
                </button>
              );
            })}
            <div className="space-y-3 border-t border-line pt-3">
              <div className="flex items-center justify-between gap-2 px-1"><span className="text-sm font-semibold text-muted">{t.nav_language}</span><LangSwitcher compact up /></div>
              {children}
            </div>
          </div>
          {canUp && <button type="button" data-nobusy aria-label={t.nav_scroll_up} onClick={() => scrollBy(-1)} className="absolute right-3 top-1 grid h-9 w-9 place-items-center rounded-full bg-surface text-primary shadow ring-1 ring-line"><ChevronUp size={20} /></button>}
          {canDown && <button type="button" data-nobusy aria-label={t.nav_scroll_down} onClick={() => scrollBy(1)} className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-surface text-primary shadow ring-1 ring-line"><ChevronDown size={20} /></button>}
        </div>
      </div>
    </div>
  );
}

export function SignOutButton({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <form action={signOutAction} className={className}>
      <SubmitButton variant="ghost" className="w-full"><LogOut size={18} aria-hidden="true" />{t.nav_signout}</SubmitButton>
    </form>
  );
}
