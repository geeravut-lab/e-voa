# Knowledge → ThaiPass e-VOA: what each RooSuk knowledge file becomes here

Source files: `docs/*-KNOWLEDGE.md` (index: `docs/Knowledge-Index.md`). The stack differs (RooSuk used TanStack Start/Netlify in places); the ideas are kept and the code is written for Next.js 16 + Supabase + Vercel.

Status: ✅ built in Phase 0 · 🟡 base built, grows with later phases · ⬜ planned

| # | Knowledge | What it gives ThaiPass e-VOA | Where it lives | Status |
| --- | --- | --- | --- | --- |
| 1 | **BRANDING** | Admin changes name, logo, tab icon without a deploy; defaults are the ThaiPass logo and favicon. Private bucket, versioned files, `/brand/logo` and `/brand/favicon` with ETag, square-PNG check for the icon (it is also the phone app icon). | `lib/brand/*`, `/admin/branding`, `app/manifest.ts`, root layout metadata | ✅ |
| 2 | **LIVE-SYNC** | Travelers see "approved / action needed" without refreshing; Ops sees new work instantly. DB sends an empty ping; page re-reads itself with the user's own permissions. Polling fallback. | `lib/live/watch.ts`, `components/LiveSync.tsx`, `/api/live*`, SQL `live_ping` | ✅ base · topics for applications arrive in Phase 2 (`u:<user>` already covers every status change that sends a notification) |
| 3 | **SSO-Aivora-Supabase** | "Sign in with LINE" through the Aivora hub; accounts matched by `aivora_user_id` only (never by email), service key stays on the server, ticket removed from the URL before the first await, 6 console checkpoints, 15 s time-out with retry. | `/sso/callback`, `/api/sso/exchange`, `lib/sso.ts`, table `aivora_links` | ✅ code (needs your setup) |
| 4 | **I18N** | EN/TH/ZH-CN now; new language = one registry line + one file (compiler lists missing keys). Server returns `err_*` codes, screen translates. Cookie + profile language. | `lib/i18n/*` | ✅ |
| 5 | **NAVIGATION** + **RESPONSIVE-WEB** + **BACK-BUTTON** | One menu list builds sidebar, bottom bar (raised "Apply" button), "More" sheet and home cards. Back button closes the sheet; every sub-page has "Back to …". `dvh`, safe-area, 44 px targets, 16 px inputs, no sideways scroll. | `config/nav.ts`, `components/Nav.tsx`, `BackLink.tsx` | ✅ |
| 6 | **FEATURE-FLAGS** | Switch off a login method, add-on, airport or payment channel without a deploy; off in menu, page and action. Stores only "off" keys so new features default to on. | `config/features.ts`, `lib/flags.ts`, `/admin/features` | ✅ now · per-airport / per-add-on / per-payment-method flags added with those features |
| 7 | **AUDIT-TRAIL** | Append-only record of who did what: brand/flag/fee changes, admin grants, logins. DB triggers also record admin changes. No personal data in details. | `lib/audit.ts`, table `audit_log`, `/admin/audit` | 🟡 base · Phase 2 adds: viewing a passport/photo (access log), refunds, status overrides, exports, partner redemptions |
| 8 | **ADMINS** | Admin = row in `admins`; grant/revoke only via DB functions; cannot remove yourself or the owner; admin pages answer 404 to others. | `/admin/admins`, SQL `grant_admin/revoke_admin`, `scripts/grant-admin.mjs` | ✅ · Phase 2 extends to Ops / Finance / Support / Partner-manager roles |
| 9 | **USAGE-ANALYTICS** | Own event table, no third-party trackers, events carry no content, daily "active" once per person. | `lib/analytics.ts`, `/admin/analytics` | 🟡 base · Phase 2 adds the application funnel (`apply_start` → each step → `apply_submit` → `payment_success`) to find where travelers drop out |
| 10 | **TYPOGRAPHY-COLOR** | Token-only colors, contrast checked, 16 px inputs, Thai line height 1.6, bundled fonts (no runtime call to Google). | `app/globals.css` | ✅ · ⬜ add the "no hex outside globals.css" check script |
| 11 | **LINE-NOTIFICATIONS** | Status-change messages outside the app: queue first, dedupe key per event, monthly quota with a reserve for urgent messages, retry table, Flex cards. Also the pattern for email / WhatsApp. | `lib/notify.ts` writes the in-app part today | 🟡 in-app done · ⬜ LINE/e-mail/WhatsApp channels (Phase 4; needs a LINE Official Account and an e-mail provider) |
| 12 | **AUTOMATION-RULES** | Timed work in one tick every 10 minutes, each rule idempotent and isolated: payment time-out, SLA warning to Ops, "still missing documents" nudge, partner reminder 3 days before arrival, retention purge (Q12), flight-change check. Admin can change thresholds. | `app/api/cron/tick` (+ `vercel.json`) | ⬜ endpoint ready, rules in Phase 2 |
| 13 | **AI-PROVIDER-MODEL** | Model routing per task with fallback and admin override: passport/ID reading, hotel & ticket extraction, translating Immigration's reason for rejection, assistant chat, safety check. Models read and explain; code validates (MRZ checksums, dates) and **Immigration decides**. | planned `/admin/ai` | ⬜ passport/doc extraction in Phase 2 · assistant in Phase 4 |
| 14 | **AI-PROMPTS-RULES** | Admin can ADD instructions to the assistant and extractors but not remove the core rules; two-step screening, version history. | planned `/admin/prompts` | ⬜ Phase 4 |
| 15 | **CHANGE-PASSWORD** | Not needed while sign-in is password-less (Google, LINE, e-mail code). Applies to the Agency / OTA portal if it uses passwords; passkeys/2FA considered there. | — | ⬜ Phase 4 (Agency portal) |

## Cross-cutting rules from the index, and how they show up here

| Rule | In ThaiPass e-VOA |
| --- | --- |
| A write that matches no row is not success | `putSetting`, profile update, `setLangAction` count rows |
| Hiding a button is not switching a feature off | `requireAdminAction()` first line; flags checked in page and action |
| Admin-settable values are not hard-coded in the page | fees and retention come from `platform_settings` (defaults in `config/defaults.ts`) |
| Unchecked things are never recorded as passed | applications will have real `PRE_CHECK` / `UNDER_REVIEW` states; payment is `PAID` only after the gateway confirms |
| Messages leaving the app must stand on their own | notification text includes what / which application / when |
| Fallback means keep working | settings, flags and brand read failures use code defaults |
| Migration and deploy are not simultaneous | code tolerates missing rows; SQL is idempotent |
| Plain language for users | every `err_*` code has a sentence in every language |

## Where the knowledge changes the product (not only the plumbing)

- **Live sync + Notifications** → the status timeline, the "Action needed" card and the Ops queue update by themselves.
- **Feature flags** → the owner can pause Express, an airport, an add-on or a payment method on the day Immigration changes a rule.
- **Audit + Admins** → every fee change and every look at a passport photo is traceable (PDPA).
- **Automation + Notifications** → traveler gets "please re-upload your photo" and Ops gets "SLA in 6 h" without anyone watching a screen.
- **AI provider/prompt rules** → passport and ticket reading that fills the form for the traveler, with code checks and human confirmation.
