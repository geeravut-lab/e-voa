"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { LIVE_REALTIME, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { liveConfigFor, liveTopicsFor, nextDelay } from "@/lib/live/watch";

/** Typing in a field? Then do not refresh under the user's fingers. */
const typing = () => {
  const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  return !!el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["button", "submit", "checkbox", "radio"].includes(el.type))) && !!el.value;
};

/**
 * Live sync, mounted once in the shell. The database sends an empty "ping" when something relevant changes;
 * on a ping the page re-reads itself from the server (router.refresh) with the user's own permissions, so the ping carries no data.
 * If the socket cannot connect, a slow fingerprint poll takes over.
 */
export function LiveSync({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const refreshRef = useRef(router.refresh);
  refreshRef.current = router.refresh;

  useEffect(() => {
    const cfg = liveConfigFor(pathname, { isAdmin });
    const topics = liveTopicsFor(pathname, { userId, isAdmin });
    let stopped = false;
    let socketUp = false;
    let quiet = 0;
    let baseline: string | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let tokenTimer: ReturnType<typeof setInterval> | undefined;
    const channels: RealtimeChannel[] = [];
    const states = new Map<string, string>();
    let sb: ReturnType<typeof createClient> | null = null;
    let currentToken = "";

    const refreshSoon = () => {
      if (stopped || !cfg.refresh) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(function go() {
        if (stopped) return;
        if (document.hidden) return; // caught up by the visibility handler
        if (typing()) { refreshTimer = setTimeout(go, 3000); return; }
        refreshRef.current();
      }, 300);
    };

    const poll = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/live?w=${cfg.keys.join(",")}`, { cache: "no-store" });
        if (res.status === 401) { stopped = true; return; } // signed out: stop asking
        if (!res.ok) throw new Error(String(res.status));
        const { t } = (await res.json()) as { t: string };
        if (baseline === null) baseline = t;           // first answer is only the baseline
        else if (t !== baseline) {
          if (typing()) return;                          // keep the old baseline and ask again soon
          baseline = t; quiet = 0; refreshSoon();
        } else quiet++;
      } catch { quiet++; }
    };

    const loop = () => {
      if (stopped) return;
      pollTimer = setTimeout(async () => {
        if (!socketUp) await poll();
        loop();
      }, socketUp ? 60_000 : nextDelay(cfg.intervalMs, quiet, document.hidden));
    };

    const catchUp = () => { if (!stopped && !document.hidden) { void poll(); } };

    const setAuth = async () => {
      const r = await fetch("/api/live/token", { cache: "no-store" });
      if (r.status === 401) { stopped = true; return null; }
      const { token } = (await r.json()) as { token: string };
      currentToken = token;
      await sb?.realtime.setAuth(token);
      return token;
    };

    const onState = (topic: string, status: string) => {
      states.set(topic, status);
      const all = topics.every((t) => states.get(t) === "SUBSCRIBED");
      if (all && !socketUp) { socketUp = true; void poll(); }  // connected: one catch-up read
      if (!all) socketUp = false;                              // any topic down: fall back to polling
    };

    (async () => {
      void poll();
      loop();
      if (!LIVE_REALTIME) return;
      try {
        // This client must NOT manage the login session (no cookies, no refresh). Passing `accessToken` gives it no auth layer at all,
        // so nothing can overwrite the socket's token with the anon key after we join (tested against the real Realtime service:
        // with the default auth layer a lone private channel was closed right after joining).
        sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { accessToken: async () => currentToken });
        const token = await setAuth();
        if (!token || stopped) return;
        for (const topic of topics) {
          const ch = sb.channel(topic, { config: { private: true } })
            .on("broadcast", { event: "ping" }, () => { quiet = 0; refreshSoon(); })
            .subscribe((status) => onState(topic, status));
          channels.push(ch);
        }
        tokenTimer = setInterval(() => void setAuth(), 45 * 60 * 1000);
      } catch (e) {
        console.info("[live] socket unavailable, polling instead", (e as Error).message);
      }
    })();

    document.addEventListener("visibilitychange", catchUp);
    window.addEventListener("focus", catchUp);
    window.addEventListener("online", catchUp);

    return () => {
      stopped = true;
      clearTimeout(refreshTimer); clearTimeout(pollTimer); clearInterval(tokenTimer);
      document.removeEventListener("visibilitychange", catchUp);
      window.removeEventListener("focus", catchUp);
      window.removeEventListener("online", catchUp);
      for (const ch of channels) void sb?.removeChannel(ch);
    };
    // Depend on VALUES (not objects) so a refresh does not reconnect the socket.
  }, [pathname, userId, isAdmin]);

  return null;
}
