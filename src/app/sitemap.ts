import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

// Public pages only. Pages that need a sign-in, and /admin and /api, are not listed (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/eligibility", "/fees", "/prepare", "/guide", "/help", "/extras", "/status", "/official", "/privacy", "/terms"];
  return pages.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: p === "" ? "weekly" : "monthly", priority: p === "" ? 1 : 0.6 }));
}
