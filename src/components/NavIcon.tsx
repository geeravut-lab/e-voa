import { Bell, BarChart3, Home, ListChecks, Map, MessageCircle, Palette, Plane, QrCode, Receipt, ScrollText, Search, Settings, ShieldCheck, Sparkles, ToggleRight, User, Users, ClipboardList, Link2, type LucideProps } from "lucide-react";
import type { IconName } from "@/config/nav";

const ICONS: Record<IconName, React.ComponentType<LucideProps>> = {
  home: Home, plane: Plane, search: Search, users: Users, sparkles: Sparkles, map: Map, chat: MessageCircle, receipt: Receipt,
  qr: QrCode, bell: Bell, user: User, list: ListChecks, palette: Palette, toggle: ToggleRight, shield: ShieldCheck, scroll: ScrollText,
  chart: BarChart3, settings: Settings, queue: ClipboardList, link: Link2,
};

export function NavIcon({ name, ...rest }: { name: IconName } & LucideProps) {
  const I = ICONS[name];
  return <I aria-hidden="true" strokeWidth={2} {...rest} />;
}
