import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/noto-sans-thai";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource/prompt/600.css";
import "@fontsource/prompt/700.css";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { getT } from "@/lib/i18n/server";
import { LANGS } from "@/lib/i18n/langs";
import { SITE_URL } from "@/lib/env";
import { THEME_COLOR } from "@/config/theme";
import { PwaRegister } from "@/components/PwaRegister";

export async function generateMetadata(): Promise<Metadata> {
  const { t, brandName, brand } = await getT();
  const v = brand.favicon?.version;
  const icon = v ? `/brand/favicon?v=${v}` : null;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${brandName} — ${t.app_tagline}`, template: `%s · ${brandName}` },
    description: t.app_tagline,
    applicationName: brandName,
    manifest: "/manifest.webmanifest",
    icons: icon
      ? { icon: [{ url: icon }], shortcut: [{ url: icon }], apple: [{ url: icon }] }
      : { icon: [{ url: "/icons/favicon.svg", type: "image/svg+xml" }, { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/favicon.ico", sizes: "any" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }] },
    appleWebApp: { capable: true, title: brandName, statusBarStyle: "default" },
    openGraph: { title: brandName, description: t.app_tagline, siteName: brandName, images: [{ url: "/icons/og-image.png", width: 1200, height: 630 }], type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = { themeColor: THEME_COLOR, width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang } = await getT();
  return (
    <html lang={LANGS[lang].htmlLang} dir={LANGS[lang].dir}>
      <head>
        {/* The browser offers "install" once, early, before the page is interactive: keep that offer so the Install button works later on any page. */}
        <script dangerouslySetInnerHTML={{ __html: 'window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__evoaInstall=e;window.dispatchEvent(new Event("evoa-install"))});window.addEventListener("appinstalled",function(){window.__evoaInstall=null;window.__evoaInstalled=true;window.dispatchEvent(new Event("evoa-installed"))});' }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <PwaRegister />
      </body>
    </html>
  );
}
