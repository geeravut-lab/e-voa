"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useT } from "./I18n";
import { AsyncButton } from "./Buttons";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Install as an app": one-tap button where the browser offers it (Android/Chrome), written steps for iPhone. */
export function InstallApp() {
  const t = useT();
  const [evt, setEvt] = useState<BIP | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIP); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  if (installed) return null;
  return (
    <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Download size={20} aria-hidden="true" />{t.install_title}</h2>
      {evt && (
        <AsyncButton onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null); }}>{t.install_button}</AsyncButton>
      )}
      <p className="text-sm text-muted">{t.install_ios}</p>
      <p className="text-sm text-muted">{t.install_android}</p>
    </section>
  );
}
