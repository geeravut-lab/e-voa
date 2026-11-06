"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/I18n";
import { Spinner } from "@/components/Spinner";
import { btnClass } from "@/components/buttonStyles";
import { errorText } from "@/lib/i18n/dict";
import { safeNext } from "@/lib/safe-next";

const TIMEOUT_MS = 15_000;
const log = (m: string, extra?: string) => console.info(`[sso] ${m}${extra ? " " + extra : ""}`); // checkpoints so a stuck login can be located from the console

export function SsoCallback() {
  const t = useT();
  const sp = useSearchParams();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (started.current) return;                    // React strict mode runs effects twice: never spend the one-time ticket twice
    started.current = true;
    const ticket = sp.get("sso_ticket");
    const next = safeNext(sp.get("next"));
    const slowTimer = setTimeout(() => setSlow(true), TIMEOUT_MS);

    (async () => {
      if (!ticket) return setError("err_sso_ticket");
      log("1 ticket found");
      // The ticket works once for 60 s: remove it from the address bar BEFORE the first await so a refresh cannot replay it.
      const clean = new URL(window.location.href);
      clean.searchParams.delete("sso_ticket");
      window.history.replaceState(null, "", clean.pathname + clean.search);

      let tokens: { access_token: string; refresh_token: string };
      try {
        const res = await fetch("/api/sso/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket }), signal: AbortSignal.timeout(TIMEOUT_MS) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return setError(data.error ?? "err_generic");
        tokens = data;                              // kept in memory; a retry below only repeats setSession, never the exchange
        log("2 ticket exchanged");
      } catch (e) {
        console.error("[sso] exchange request failed", (e as Error).message);
        return setError("err_sso_hub");
      }

      const supabase = createClient();
      let userId: string | undefined;
      for (let attempt = 1; attempt <= 3 && !userId; attempt++) {
        const { data, error: se } = await supabase.auth.setSession(tokens);
        if (!se) userId = data.user?.id ?? data.session?.user.id;
        else console.error("[sso] setSession failed", attempt, se.message);
      }
      if (!userId) return setError("err_generic");
      log("3 session set", `user=${userId}`);

      // Explicit bootstrap (do not depend on an auth-state listener): confirm the profile row exists, then leave.
      log("4 bootstrap start");
      let ready = false;
      for (let i = 0; i < 5 && !ready; i++) {
        const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
        ready = !!data;
        if (!ready) await new Promise((r) => setTimeout(r, 400));
      }
      if (!ready) { console.error("[sso] profile row missing after sign-in"); return setError("err_generic"); }
      log("5 profile ready");
      log("6 bootstrap done");
      window.location.replace(next);                // hard navigation so the server sees the new cookies
    })().catch((e) => { console.error("[sso] unexpected", (e as Error).message); setError("err_generic"); });

    return () => clearTimeout(slowTimer);
  }, [sp]);

  if (error)
    return (
      <div role="alert" className="mx-auto max-w-md space-y-4 rounded-card border border-line bg-surface p-6 text-center shadow-card">
        <p className="font-semibold text-danger">✕ {errorText(error, t)}</p>
        <a href="/login" className={btnClass("primary")}>{t.retry}</a>
      </div>
    );
  return (
    <div className="grid min-h-[40dvh] place-items-center text-center" role="status">
      <div className="space-y-3 text-primary">
        <Spinner size={40} className="mx-auto" />
        <p className="font-semibold text-ink">{t.sso_checking}</p>
        {slow && <p className="text-sm text-muted">{t.sso_slow} <a href="/login" className="font-semibold text-primary underline">{t.retry}</a></p>}
      </div>
    </div>
  );
}
