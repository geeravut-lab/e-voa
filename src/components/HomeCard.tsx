import { Lock } from "lucide-react";
import { ART } from "./Art";
import { AppLink } from "./AppLink";
import type { NavItem } from "@/config/nav";

/** One big, friendly menu card with an illustration. Locked (sign-in needed) cards carry a small lock like the RooSuk home. */
export function HomeCard({ item, href, label, sub, locked, lockedLabel }: { item: NavItem; href: string; label: string; sub?: string; locked: boolean; lockedLabel: string }) {
  const wide = item.size === "wide";
  return (
    <AppLink
      href={href}
      className={`tone-${item.tone} pressable group flex overflow-hidden rounded-card border p-4 shadow-card ${
        wide ? "col-span-2 min-h-36 items-center" : "col-span-1 min-h-44 flex-col"
      }`}
    >
      {locked && (
        <span className="absolute left-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-ink/10 text-ink/70" title={lockedLabel}>
          <Lock size={13} aria-label={lockedLabel} />
        </span>
      )}
      <div className={`relative z-[1] ${wide ? "max-w-[58%]" : "max-w-full"} ${locked ? "pt-4" : ""}`}>
        <h3 className="text-[17px] font-extrabold leading-snug">{label}</h3>
        {sub && <p className="mt-1 text-[13px] leading-snug text-muted">{sub}</p>}
      </div>
      <div
        className={`pointer-events-none absolute transition-transform duration-300 group-hover:scale-105 ${
          wide ? "-right-1 bottom-1 top-1 w-[44%]" : "-bottom-1 -right-1 h-[62%] w-[78%]"
        }`}
      >
        {item.art ? ART[item.art] : null}
      </div>
    </AppLink>
  );
}
