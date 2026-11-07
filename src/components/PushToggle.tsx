"use client";
import { useEffect, useState } from "react";
import { AsyncButton } from "@/components/Buttons";
import { useT } from "@/components/I18n";
import { errorText } from "@/lib/i18n/dict";
import { savePushAction, removePushAction } from "@/app/actions/push";

const b64ToBytes = (s: string) => { const pad = "=".repeat((4 - (s.length % 4)) % 4), raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
type State = "checking" | "unsupported" | "blocked" | "off" | "on";

/** Phone notifications for this browser: asks permission, subscribes, and tells the server. Needs the app to be served over https with the service worker. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const t = useT();
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return live && setState("unsupported");
        if (Notification.permission === "denied") return live && setState("blocked");
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (live) setState(sub && Notification.permission === "granted" ? "on" : "off");
      } catch { if (live) setState("unsupported"); }
    })();
    return () => { live = false; };
  }, []);

  const turnOn = async () => {
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "blocked" : "off"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) as BufferSource }));
      const r = await savePushAction(sub.toJSON());
      if (r?.ok) setState("on"); else { await sub.unsubscribe().catch(() => false); setMsg(r && !r.ok ? errorText(r.error, t) : errorText("err_generic", t)); }
    } catch { setMsg(errorText("err_generic", t)); }
  };
  const turnOff = async () => {
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
      if (sub) { await removePushAction(sub.endpoint); await sub.unsubscribe(); }
      setState("off");
    } catch { setMsg(errorText("err_generic", t)); }
  };

  return (
    <div className="space-y-3">
      {state === "checking" && <p className="text-sm text-muted">…</p>}
      {state === "unsupported" && <p className="text-sm text-muted">{t.push_unsupported}</p>}
      {state === "blocked" && <p className="text-sm font-semibold text-gold-deep">{t.push_blocked}</p>}
      {state === "off" && <AsyncButton onClick={turnOn}>{t.push_enable}</AsyncButton>}
      {state === "on" && <><p className="text-sm font-semibold text-success">✓ {t.push_on}</p><AsyncButton variant="ghost" onClick={turnOff}>{t.push_disable}</AsyncButton></>}
      <div aria-live="polite" className="min-h-5 text-sm font-semibold text-danger">{msg}</div>
    </div>
  );
}
