# Setup: Supabase + Vercel + GitHub (do this once)

## Status on 6 Nov 2026 (Supabase work done by Claude through the Management API)

| Item | State |
| --- | --- |
| Foundation SQL (`supabase/migrations/20261106000100_foundation.sql`) | ✅ applied to project `ytzktizvmeayugdfzzlk`; 7 tables with RLS, 7 policies, private bucket `brand-assets`, seed settings |
| Auth: Site URL `https://e-voa.vercel.app`; redirect list `…/auth/callback` + `http://localhost:3000/auth/callback`; e-mail code length 6, expiry 15 min | ✅ |
| End-to-end test on the real project (`npm run e2e:supabase`): profile trigger, session minting, RLS, live sync over Realtime | ✅ all 18 checks pass |
| Google provider | ⬜ **not enabled yet** (`external_google_enabled=false`, no client id). You must paste the Google client ID and secret in Supabase → Authentication → Providers → Google, and add Supabase's callback URL to the Google OAuth client |
| E-mail code sign-in | ⏸ switched **off** (feature flag `login_email`). The free plan with Supabase's built-in mailer cannot change e-mail templates (the mail has a link, not a code) and sends only 2 e-mails per hour. Needs custom SMTP (Resend, SendGrid, Amazon SES …) then the template with `{{ .Token }}`; then turn the switch back on at `/admin/features` |
| Vercel env vars, first owner, Aivora hub registration | ⬜ yours (sections 2–4 below) |
| Project region | ⚠ `ap-northeast-1` (Tokyo), not Singapore as planned in Q9. Moving later means a new project and a data migration |

> Tip for Claude sessions: Supabase hosts are allowed in the environment and a Personal Access Token is injected for `api.supabase.com`. From Node use `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`. Revoke the token when the work is done.

The code build sandbox cannot reach your Supabase project, so **the sign-in, brand upload and live-sync features have not been tested against it yet**. Follow this list, then use the checks at the end.

## 1. Supabase (`https://ytzktizvmeayugdfzzlk.supabase.co`)

1. ~~SQL Editor → run `supabase/migrations/20261106000100_foundation.sql`~~ (already applied; safe to re-run).
2. **Project Settings → API**: copy the *anon / publishable* key and the *service_role* key (you need them in step 2).
3. **Authentication → URL Configuration**: Site URL `https://e-voa.vercel.app`; Redirect URLs: `https://e-voa.vercel.app/auth/callback`, `http://localhost:3000/auth/callback` (and your Vercel preview pattern if you use previews).
4. **Authentication → Providers**: Google is already set (its authorized redirect is the Supabase callback URL shown in that page). Email must be enabled.
5. **Authentication → Email Templates → "Magic Link"** (and "Confirm signup"): include the code, e.g. `Your code: {{ .Token }}`, so the e-mail sign-in shows a 6-digit code.
6. **Realtime**: leave enabled. Live sync uses *private* channels; the SQL creates the listening policy on `realtime.messages`. If the migration printed nothing about it, open Realtime → Policies and confirm `live_signals_listen` exists.

## 2. Vercel (project `e-voa`, linked to GitHub `geeravut-lab/e-voa`, branch `main`)

Environment variables (Production and Preview):

| Name | Value | Public? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ytzktizvmeayugdfzzlk.supabase.co` | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key | yes |
| `NEXT_PUBLIC_SITE_URL` | `https://e-voa.vercel.app` | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **NO — never `NEXT_PUBLIC_`** |
| `CRON_SECRET` | any long random string | no |
| `AIVORA_HUB_URL` | `https://aivora-lc.netlify.app` (default) | no |
| `AIVORA_APP_SLUG` | `e-voa` (default) | no |

Framework preset: Next.js, root directory = repository root. Redeploy after saving variables.

> Note: `docs/SSO-Aivora-Supabase.md` lists a different `SUPABASE_URL` (`vlxsvg…`). That is the example from another app; this app uses **your** project URL above.

## 3. First owner

Sign in once on the site (Google or e-mail code), then on your computer:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ytzktizvmeayugdfzzlk.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service key> \
node scripts/grant-admin.mjs you@example.com --owner
```

(or in the SQL editor: `insert into public.admins (user_id, is_owner) select id, true from auth.users where email = 'you@example.com';`). The owner cannot be removed from the app.

## 4. LINE (Aivora hub)

Register the app at the Aivora hub: slug `e-voa`, callback `https://e-voa.vercel.app/sso/callback`. The real ticket exchange can only be tested by pressing the app tile in the hub's Launcher (tickets last 60 s).

## 5. Checks before you call it done

| # | Check | Expected |
| --- | --- | --- |
| 1 | Sign in with Google | lands on the home page, name shown |
| 2 | Sign in with e-mail code | code arrives, sign-in works |
| 3 | LINE from the Launcher, in a normal browser **and** inside LINE | no endless spinner; row in `auth.users` with `app_metadata.aivora_user_id`; row in `profiles`; console shows 6 `[sso]` lines |
| 4 | `/admin` as a non-admin | 404 page |
| 5 | `/admin/branding`: upload a PNG icon ≥192 px, change the name | tab icon and name change within ~1 minute |
| 6 | Account → "Send myself a test notification" with the app open in two tabs | bell count changes in both tabs without refresh |
| 7 | Switch Realtime off (`NEXT_PUBLIC_LIVE_REALTIME=0`, redeploy) and repeat 6 | still updates, a few seconds later (polling) |
| 8 | `/admin/features`: turn "Sign in with LINE" off | button disappears; `/api/sso/exchange` answers 403 |
| 9 | Open the site JS in DevTools → Sources and search for `service_role` | no match (the build was checked for this) |
