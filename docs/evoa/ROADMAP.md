# ThaiPass e-VOA — Roadmap and status

Legend: ✅ done · 🟡 started / needs your action · ⬜ not started. Owner decisions are in [02-FUNCTIONS-FEATURES-DESIGN.md §6](./02-FUNCTIONS-FEATURES-DESIGN.md) and the answers below.

## Decisions recorded (from the owner)

| # | Decision |
| --- | --- |
| Q1 | Immigration API (direct), same API and parameters as the previous intermediary |
| Q2 | Brand name **ThaiPass e-VOA**; must never look like a government site; must state it is an authorized service provider (⚠ only publish that wording once the authorization is real) |
| Q3 | Service fee: Regular 600 THB, Express 2,500 THB (government visa fee 2,000 THB) |
| Q4 | Refund: unused add-ons only; visa fee and service fee are not refunded; stated clearly before paying |
| Q5 | Payment: Stripe + a local gateway; the customer chooses |
| Q6 | Languages at launch: EN, TH, ZH-CN; HI, AR, RU, KO, JA, ZH-TW to be easy to add later |
| Q7 | Add-ons at launch: insurance, SIM/eSIM, VIP services, Beauty & Health |
| Q8 | E-VOA delivered both digital and printable |
| Q9 | Next.js (App Router) + Supabase (Singapore) + encrypted Storage + queue (Vercel Cron / QStash) |
| Q10 | All nationalities; marketing focused on 3–5 markets first |
| Q11 | Agency portal in Phase 2+, data model ready from day one |
| Q12 | Document retention set by Admin; default delete images 90 days after travel |

## Phase 0 — Foundation (this phase)

| Item | Status |
| --- | --- |
| Next.js 16 + Tailwind + Supabase project, Vercel config, env example | ✅ |
| Brand ThaiPass e-VOA: logo, favicon, PWA icons, OG image | ✅ |
| Admin can upload logo / favicon / change name (BRANDING knowledge) | ✅ code · 🟡 needs SQL + service key to run |
| Home page with illustrated cards for every role + mobile bottom bar + "More" sheet | ✅ |
| Spinner on every button / menu / link | ✅ |
| Live sync (database ping → page refreshes itself, polling fallback) | ✅ code · 🟡 needs SQL + Realtime to run |
| Sign in: Google, email code, LINE (Aivora SSO) | ✅ code · 🟡 needs your Supabase/Vercel setup (see 05-SETUP.md) |
| Languages EN/TH/ZH-CN with easy extension | ✅ |
| Feature switches, Audit trail, Admin management, Usage analytics, in-app notifications, settings (fees, retention) | ✅ |
| Knowledge → feature mapping | ✅ [04-KNOWLEDGE-MAPPING.md](./04-KNOWLEDGE-MAPPING.md) |
| Foundation SQL applied to your Supabase project; Auth URLs and OTP length set; 18 end-to-end checks pass on the real project | ✅ |
| **Your action**: enable Google provider (client ID/secret), set env vars in Vercel, sign in once and grant the first owner, register the app at the Aivora hub (05-SETUP.md) | 🟡 |
| Custom SMTP, then turn e-mail code sign-in back on | 🟡 |
| Browser-level test of the three sign-in paths on the deployed site | 🟡 after Vercel env vars |

## Phase 1 — Immigration connection and data model (weeks 1–4)

⬜ Immigration API specification from Immigration Bureau (needed by week 2) · ⬜ `ImmigrationGateway` adapter (+ sandbox mock) · ⬜ master-data sync (nationality, airports, airlines, provinces/districts, document types) ·
⬜ schema: travelers, trips, applications, documents, payments, status history, partners, agencies · ⬜ status state machine · ⬜ private encrypted document storage with short-lived links · ⬜ retention purge job on the cron tick

## Phase 2 — Application and payment (weeks 3–6)

⬜ Eligibility check · ⬜ application wizard (package → documents → extras → pay) · ⬜ passport MRZ/OCR + photo quality check · ⬜ flight lookup · ⬜ group applications ·
⬜ checkout with Stripe + local gateway, receipts, reconciliation · ⬜ status timeline + notifications · ⬜ E-VOA Pass (QR, PDF, offline) · ⬜ Ops console (queue, document review, SLA timers) · ⬜ refund rules (Q4)

## Phase 3 — Add-ons (weeks 5–8)

⬜ Insurance · ⬜ SIM/eSIM · ⬜ VIP services · ⬜ Beauty & Health · ⬜ partner API pattern (package list → buy → confirm → callback) · ⬜ add-on rules per airport / package (e.g. not for Express)

## Go-live gate (week 8)

⬜ UAT with Immigration Bureau · ⬜ security audit / pen-test · ⬜ load test · ⬜ PDPA/GDPR review · ⬜ revoke old keys found in legacy documents

## Phase 4+ — Growth

⬜ AI assistant (provider/model routing, prompts and rules) · ⬜ LINE / WhatsApp notifications and quotas · ⬜ automation rules engine (SLA reminders, payment time-outs) · ⬜ Agency / OTA portal · ⬜ Partner portal · ⬜ more languages (HI, AR, RU, KO, JA, ZH-TW) · ⬜ Wallet passes · ⬜ Government/TAT dashboard
