import { Lock } from "lucide-react";
import { ART } from "./Art";
import { AppLink } from "./AppLink";
import type { NavItem } from "@/config/nav";

/**
 * One big, friendly menu card with an illustration. Locked (sign-in needed) cards carry a small lock like the RooSuk home.
 * Layout rule: the picture never sits on top of the words.
 *  - half-width card: text first, picture in its own row UNDER the text (the card grows if the text needs more lines)
 *  - wide card: text limited to the left 58%, picture in the right 42%
 */
export function HomeCard({ item, href, label, sub, locked, lockedLabel }: { item: NavItem; href: string; label: string; sub?: string; locked: boolean; lockedLabel: string }) {
  const wide = item.size === "wide";
  const art = item.art ? ART[item.art] : null;
  return (
    <AppLink
      href={href}
      className={`tone-${item.tone} pressable group flex overflow-hidden rounded-card border p-4 shadow-card ${wide ? "col-span-2 min-h-36 items-center" : "col-span-1 min-h-44 flex-col"}`}
    >
      {locked && (
        <span className="absolute left-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-ink/10 text-ink/70" title={lockedLabel}>
          <Lock size={13} aria-label={lockedLabel} />
        </span>
      )}
      <div className={`relative z-[1] ${wide ? "max-w-[58%]" : ""} ${locked ? "pt-4" : ""}`}>
        <h3 className="text-[17px] font-extrabold leading-snug">{label}</h3>
        {sub && <p className="mt-1 text-[13px] leading-snug text-muted">{sub}</p>}
      </div>
      {wide ? (
        <div className="pointer-events-none absolute -right-1 bottom-1 top-1 w-[42%] transition-transform duration-300 group-hover:scale-105">{art}</div>
      ) : (
        <div className="pointer-events-none mt-auto flex justify-end pt-2">
          <div className="h-[84px] w-[112px] transition-transform duration-300 group-hover:scale-105">{art}</div>
        </div>
      )}
    </AppLink>
  );
}
