# Setup: Supabase + Vercel + GitHub (do this once)

## Status on 6 Nov 2026 (Supabase work done by Claude through the Management API)

| Item | State |
| --- | --- |
| Foundation SQL (`…000100_foundation.sql`) and Phase 1 SQL (`…000200_phase1_core.sql`) | ✅ both applied to project `ytzktizvmeayugdfzzlk`; 7 tables with RLS, 7 policies, private bucket `brand-assets`, seed settings |
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
| `DATA_ENCRYPTION_KEY` | 32 random bytes, base64 (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). **Back it up: without it passport numbers and files cannot be read.** | **NO** |
| `IMMIGRATION_API_URL` / `IMMIGRATION_API_TOKEN` / `IMMIGRATION_API_FROM` | From Immigration (not available yet). Leave empty until then | **NO** |
| `IMMIGRATION_CALLBACK_SECRET` | Random string you give to Immigration for `POST /api/immigration/callback` | **NO** |
| `STRIPE_SECRET_KEY` | Stripe **test** secret key (`sk_test_…`). Use the live key only when you decide to take real money | **NO** |
| `STRIPE_WEBHOOK_SECRET` | In Stripe → Developers → Webhooks add `https://e-voa.vercel.app/api/stripe/webhook` (events `checkout.session.completed`, `checkout.session.expired`), copy its signing secret here. The return page also asks Stripe directly, so payments are confirmed even before the webhook is set | **NO** |
| `PARTNER_INSURANCE_URL` `PARTNER_SIM_URL` `PARTNER_VIP_URL` `PARTNER_BHS_URL` | Partner API base addresses (not available yet). Empty = that add-on is simply not offered | **NO** |
| `INSURANCE_G_API_KEY` `INSURANCE_TOKEN` | Insurance partner credentials | **NO** |
| `PARTNER_SECRET` `PARTNER_PUBLIC_KEY` | SIM / VIP / Beauty & Health request signing (assumed HMAC; confirm with each partner) | **NO** |
| `PARTNER_CALLBACK_SECRET` | Random string you give the partners for `POST /api/partners/<provider>/<path>` | **NO** |
| `FLIGHT_API_URL` `FLIGHT_API_KEY` | Optional flight-number lookup provider (`GET /flights/lookup?flight=&date=`) | **NO** |
| `AIVORA_HUB_URL` | `https://aivora-lc.netlify.app` (default) | no |
| `AIVORA_APP_SLUG` | `e-voa` (default) | no |

After saving the variables, **redeploy**, then open `https://e-voa.vercel.app/api/health`: it lists (yes/no, never the values) what is configured. `"ok": true` is required for sign-in and applications. `NEXT_PUBLIC_*` values are baked in at build time, so they only take effect after a new deployment.

### Stripe webhook (test mode)
1. Stripe Dashboard → switch to **Test mode** → Developers → **Webhooks** → **Add endpoint** (or "Add destination").
2. Endpoint URL: `https://e-voa.vercel.app/api/stripe/webhook`.
3. Events: `checkout.session.completed` and `checkout.session.expired`.
4. Save, open the endpoint, **Reveal** the *Signing secret* (`whsec_…`) and put it in Vercel as `STRIPE_WEBHOOK_SECRET`; redeploy.
5. Pay once with card `4242 4242 4242 4242`, any future date, any CVC. The return page also asks Stripe directly, so payment is confirmed even if the webhook is late.

### E-mail (Resend) for "forgot password" and notices
Resend's test sender `onboarding@resend.dev` can only deliver to the e-mail of your own Resend account (use `geeravut@gmail.com`). In Supabase → Authentication → Emails → **SMTP Settings**: enable custom SMTP, sender `onboarding@resend.dev`, host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key (Resend → API Keys). Registering with other e-mails works without SMTP (password sign-up needs no e-mail); only reset mails to other addresses need your own domain.

Cron: `vercel.json` runs `/api/cron/tick` once a day (the Hobby plan limit). To run it every 10 minutes (queue retries, polling), either upgrade to Pro, or call `https://e-voa.vercel.app/api/cron/tick` with `Authorization: Bearer <CRON_SECRET>` from Supabase pg_cron + pg_net or any scheduler.

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

## Where each partner / Immigration variable comes from (leave empty until you have it)

| Variable | From | Needed now? |
| --- | --- | --- |
| `IMMIGRATION_API_URL`, `IMMIGRATION_API_TOKEN`, `IMMIGRATION_API_FROM` | Thai Immigration (same API as the former intermediary: base address, access token, and the `From` value they register for you) | No. Empty = paid applications wait in "checking documents"; nothing is sent |
| `IMMIGRATION_CALLBACK_SECRET` | You create it (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) and give it to Immigration with the callback address `https://e-voa.vercel.app/api/immigration/callback` | When Immigration is connected |
| `INSURANCE_G_API_KEY`, `INSURANCE_TOKEN`, `PARTNER_INSURANCE_URL` | The insurance partner (new keys issued for ThaiPass) | No. Empty = insurance is not offered |
| `PARTNER_SECRET`, `PARTNER_PUBLIC_KEY`, `PARTNER_SIM_URL`, `PARTNER_VIP_URL`, `PARTNER_BHS_URL` | The SIM/eSIM, VIP and Beauty & Health partners. The code uses one key pair for all three; if they give different pairs, say so and the code is adjusted | No. Empty = that add-on is not offered |
| `PARTNER_CALLBACK_SECRET` | You create it (same command) and give it to the partners with `https://e-voa.vercel.app/api/partners/<insurance|sim|vip|bhs>/<their original path>` | When a partner is connected |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend → API Keys. Needed for e-mail notices and PDF receipts (the Supabase SMTP setting only covers sign-in e-mails). `MAIL_FROM` defaults to `ThaiPass e-VOA <onboarding@resend.dev>`, which delivers only to your own Resend account address until you verify a domain | Optional |
| `FLIGHT_API_URL`, `FLIGHT_API_KEY` | A flight-data provider. The reply format must match what the code reads (see `src/lib/flights.ts`); a different provider needs a small adapter | No. Empty = the traveler types airline, airport and time |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys. Turns on the help assistant (`/help/chat`). Limits and on/off are set at `/admin/ai`, and so are the provider and model of each job (defaults in code: Claude Sonnet 5.5 for answers, Claude Haiku 5.5 for the instruction checker, Gemini 3 Flash as spare) (daily budget, so a bad day cannot cost more than you chose). **Not yet tried against the real model** (only against the simulator) | Optional |
| `GOOGLE_AI_API_KEY` | aistudio.google.com → API keys (use a **paid** project: a free-tier key may learn from what travelers type, and the test button at `/admin/ai` warns about it). A second AI provider: the spare when Claude fails, or the main one. Which provider and model answers each job is chosen at `/admin/ai` (a provider without a key cannot be chosen; the key itself is never shown). Change takes effect within about a minute | Optional |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Run `npm run vapid` on your computer: it prints a new key pair to the screen (nothing is saved). Put the two keys in the Vercel environment settings; `VAPID_SUBJECT` is `mailto:` plus your address (or your https site). Turns on phone notifications (Web Push) at `/account/notifications`. Never commit the private key | No. Without them the switch is not shown |
| `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_BASIC_ID` | LINE Developers → your Messaging API channel. Register `https://e-voa.vercel.app/api/line/webhook` as the webhook and turn "Use webhook" on. Travelers connect from `/account/notifications` with a one-time code; limits at `/admin/messaging` | Optional |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE_NOTICE`, `WHATSAPP_TEMPLATE_CODE`, `WHATSAPP_TEMPLATE_LANG` | Meta WhatsApp Cloud API. Only approved **template** messages are sent: one with one text parameter for notices and one with one parameter for the verification code. Not yet tried against the real service | Optional |
| `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_WALLET_PRIVATE_KEY` (+ optional `GOOGLE_WALLET_CLASS_ID`, `GOOGLE_WALLET_BG_COLOR`) | Google Pay & Wallet Console → Google Wallet API → **Issuer ID**; Google Cloud → enable *Google Wallet API*, create a **service account** and a **JSON key** (`client_email`, `private_key`); invite the service account as Developer in the Wallet Console. Turns on **Add to Google Wallet** on the E-VOA pass (approved applications only). The private key may be pasted with `\n` for line breaks. Until Google approves publishing access, only accounts added as *Test users* can save the pass. A saved pass is updated by the daily tick when the application changes (status shown, greyed out when no longer valid) | Optional |
| `APPLE_WALLET_PASS_TYPE_ID`, `APPLE_WALLET_TEAM_ID`, `APPLE_WALLET_CERT`, `APPLE_WALLET_KEY`, `APPLE_WALLET_WWDR` (+ optional `APPLE_WALLET_KEY_PASSPHRASE`, `APPLE_WALLET_BG_COLOR`) | developer.apple.com (Apple Developer Program, about 99 USD a year) → Identifiers → **Pass Type IDs** (`pass.…`) → create a certificate from a CSR you make (keep the private key); download the certificate and convert it to PEM; download Apple's **WWDR** certificate (G4) and convert it to PEM. Team ID is on the membership page. PEM text can be pasted with `\n` for line breaks or as base64 of the file. Turns on **Add to Apple Wallet** on the E-VOA pass and lets the phone ask for newer versions (`/api/wallet/apple`) | Optional |

Never put the simulator's values in Vercel, never reuse keys found in the legacy documents, and never put any of these in a file or a commit.

## Notes from setting up the real site

- **"Not set" means empty or deleted.** A value typed as `null`, `none` or `-` is treated as NOT set (so it can never be used as an address or a secret), but the clean way is to delete the variable or leave it blank.
- **`DATA_ENCRYPTION_KEY`** must be random and decode to 32 bytes or more (longer is accepted). Create it with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` (44 characters ending in `=`); do not use a password or a shortened text. `/api/health` shows `DATA_ENCRYPTION_KEY_decoded_bytes` (it must be at least 32). Change it only before real data exists: afterwards it can never be changed without losing the stored passport numbers and files.
- **Flight lookup with AeroDataBox:** `FLIGHT_API_URL` = `https://aerodatabox.p.rapidapi.com` (RapidAPI; `FLIGHT_API_KEY` = your X-RapidAPI-Key) or `https://prod.api.market/api/v1/aedbx/aerodatabox` (API.Market; `FLIGHT_API_KEY` = your x-api-market-key). The adapter is covered by unit tests with a sample answer, **not yet tried against the real service**: try a flight that lands in Thailand 10–30 days from now.
- **Testing without partners:** the simulator (`npm run mock`) is for local development and the automated tests; the live site never talks to it. To click through the add-ons yourself, run the app locally (`npm run dev`) with the `PARTNER_*` values from `06-MOCK-PARTNERS.md`.
- **AeroDataBox bought directly on aerodatabox.com:** the key page shows the key as INACTIVE until you have an active subscription or API credits. Put the base address from their API documentation in `FLIGHT_API_URL` (no trailing `/`) and, if their examples send the key in a header other than `x-api-key`, its name in `FLIGHT_API_KEY_HEADER`. Not yet tried against the real service.

## Phase 4 notes

- **Agency portal** (`/agency`): a company registers, staff approve it at `/admin/agencies` and set the service-fee discount and commission. The registration document is private (staff only). Colleagues are added by the owner (they sign in once first). Bulk import of travelers from a CSV (template at `/agency/template.csv`).
- **Partner portal** (`/partner`): a company that sells SIM / VIP / health / insurance **without an API** registers, staff approve it at `/admin/partners` and set its share (default 80 %). It lists its own packages; a traveler who buys one gets a voucher code (`TP-XXXXXXXX`); the partner types the code at its counter to redeem it. Monthly CSV at `/partner/settlement.csv`; staff record the payout per month (`Mark as paid`), which can happen only once per month. Partners connected through an API keep working as before.
- **Camera and viewing:** the face photo can be taken with the device camera (needs HTTPS and camera permission; phones without it fall back to the system camera). Any uploaded file can be viewed by its owner (and staff, audited) from the wizard and the trip page.
- Apply the new migrations in order (`20261109…` to `20261115…`) in the Supabase SQL editor if you run them yourself.
- **Languages:** the six newest languages are partly translated (see `docs/evoa/08-STATUS.md`). New fonts are bundled from `@fontsource-variable/*` (Devanagari, Arabic, JP, KR, TC); no setup needed.
- **Rules engine:** runs inside `/api/cron/tick`. On the free Vercel plan the cron runs once a day; set a shorter schedule in `vercel.json` on a paid plan (`TICK_BUDGET_MS` can raise the 20 s limit).
