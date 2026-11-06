import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/apply", "/trips", "/pass", "/pay", "/receipts", "/travelers", "/account", "/notifications", "/login", "/sso", "/auth", "/v/"] }], sitemap: `${SITE_URL}/sitemap.xml` };
}
