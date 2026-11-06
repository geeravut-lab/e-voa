// Renders the app's own illustrations and icons to static SVG strings for the infographic (run through vite-node by build.mjs).
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { createElement } from "react";
import * as L from "lucide-react";
import { ART, HeroThailand } from "../../src/components/Art";

const out: Record<string, string> = { hero: renderToStaticMarkup(<HeroThailand />) };
for (const [k, v] of Object.entries(ART)) out[`art_${k}`] = renderToStaticMarkup(<div style={{ width: "100%", height: "100%" }}>{v}</div>);
const icons = ["ScanLine", "Camera", "ShieldCheck", "Bell", "QrCode", "Plane", "CreditCard", "Receipt", "Search", "Smartphone", "Languages", "Users", "Building2", "Store", "Headset", "MessageCircle", "Map", "ListChecks", "Lock", "FileCheck2", "Globe", "Sparkles", "Wifi", "Crown", "HeartPulse", "Umbrella", "Download", "Clock", "Zap", "BadgeCheck", "FileText", "RefreshCcw", "UserCheck", "Ticket", "BarChart3", "ClipboardList", "Handshake", "Banknote", "Eye", "Trash2", "Scale", "LayoutGrid", "MapPin", "Star", "Check", "ArrowRight", "ChevronRight"] as const;
for (const n of icons) { const C = (L as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>>)[n]; if (!C) { console.error("missing icon", n); continue; } out[`i_${n}`] = renderToStaticMarkup(createElement(C, { size: 28, strokeWidth: 2 })); }
writeFileSync(process.argv[2] ?? "art.json", JSON.stringify(out));
console.log("art ok", Object.keys(out).length);
