"use client";
import { useEffect } from "react";

/** Registers the service worker (production only) so the app can be installed and shows an offline page. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.info("[pwa] service worker not registered", e?.message));
  }, []);
  return null;
}
