import type { MetadataRoute } from "next";
import { getT } from "@/lib/i18n/server";
import { BACKGROUND_COLOR, THEME_COLOR } from "@/config/theme";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { t, brandName, brand } = await getT();
  const custom = brand.favicon?.version;
  return {
    id: "/",
    name: brandName,
    short_name: brandName.length > 12 ? brandName.slice(0, 12) : brandName,
    description: t.app_tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    icons: custom
      ? [
          { src: `/brand/favicon?v=${custom}`, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: `/brand/favicon?v=${custom}`, sizes: "512x512", type: "image/png", purpose: "any" },
        ]
      : [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
  };
}
