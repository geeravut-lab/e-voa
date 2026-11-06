"use client";
import { useEffect, useState } from "react";
import { Check, Download } from "lucide-react";
import { useT } from "./I18n";
import { AsyncButton } from "./Buttons";

type Offer = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global { interface Window { __evoaInstall?: Offer | null; __evoaInstalled?: boolean } }

/**
 * "Install as an app". Where the browser can install the web app (Chrome, Edge, Samsung Internet on Android and desktop) the button installs it with one tap:
 * the browser's own offer is kept early by a small script in the page head (see layout.tsx), so it is still there when this page opens.
 * iPhone / iPad cannot be installed from a button (Safari has no such call), so only there the written steps are shown.
 */
export function InstallApp() {
  const t = useT();
  const [offer, setOffer] = useState<Offer | null>(null), [installed, setInstalled] = useState(false), [ios, setIos] = useState(false), [declined, setDeclined] = useState(false);
  useEffect(() => {
    setOffer(window.__evoaInstall ?? null);
    setInstalled(!!window.__evoaInstalled || window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const on = () => setOffer(window.__evoaInstall ?? null), done = () => { setInstalled(true); setOffer(null); };
    window.addEventListener("evoa-install", on); window.addEventListener("evoa-installed", done);
    return () => { window.removeEventListener("evoa-install", on); window.removeEventListener("evoa-installed", done); };
  }, []);
  const install = async () => {
    if (!offer) return;
    await offer.prompt();
    const r = await offer.userChoice;
    window.__evoaInstall = null; setOffer(null);                 // the browser allows one prompt per offer
    if (r.outcome === "accepted") setInstalled(true); else setDeclined(true);
  };
  return (
    <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Download size={20} aria-hidden="true" />{t.install_title}</h2>
      {installed ? (
        <p role="status" className="flex items-center gap-2 rounded-control bg-mint p-3 text-sm font-semibold text-teal-deep"><Check size={18} aria-hidden="true" />{t.install_done}</p>
      ) : (
        <>
          {offer && <AsyncButton onClick={install} className="w-full">{t.install_button}</AsyncButton>}
          {!offer && !ios && <p className="text-sm text-muted">{declined ? t.install_declined : t.install_unavailable}</p>}
          {(ios || !offer) && <p className="text-sm text-muted">{ios ? t.install_ios : t.install_android}</p>}
        </>
      )}
    </section>
  );
}
