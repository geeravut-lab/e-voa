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

## Phase 0 — Foundation ✅ (code and live checks done; two items wait for you)

| Item | Status |
| --- | --- |
| Next.js 16 + Tailwind + Supabase project, Vercel config, env example | ✅ |
| Brand ThaiPass e-VOA, admin upload of logo / favicon / name | ✅ tested in a real browser against the real project |
| Home with illustrated cards, bottom bar, "More" sheet, spinners everywhere | ✅ |
| Live sync (database ping → page refreshes itself, polling fallback) | ✅ 1.3 s between two tabs; fixed a Realtime client problem found by the test |
| Sign in: Google, LINE (Aivora), e-mail code | ✅ code · 🟡 Google needs the client ID/secret in Supabase · ⏸ e-mail code switched off until you configure SMTP |
| EN / TH / ZH-CN with easy extension; feature switches; audit trail; admins; analytics; notifications; fees and retention settings | ✅ |
| PWA: service worker, offline page, "install as an app" card | ✅ |
| "No hex colors outside globals.css" check (`npm run lint:colors`) | ✅ |
| Partner simulator and the rule to test against it | ✅ `docs/evoa/06-MOCK-PARTNERS.md` |
| Foundation + Phase 1 SQL applied to your Supabase; 51 browser checks and 20 live checks pass | ✅ |
| **Your action:** Vercel env vars (incl. the new ones below), Google provider, first owner, Aivora registration, SMTP | 🟡 see 05-SETUP.md |
| Browser test of the three sign-in paths on the deployed site | 🟡 after the Vercel variables |
| Cron: Vercel Hobby allows one run per day → the tick runs daily; for every 10 minutes use Supabase pg_cron or another scheduler | 🟡 your decision |

## Phase 1 — Immigration connection and data model ✅ (built and tested with the simulator; waits for the real API)

| Item | Status |
| --- | --- |
| Schema: travelers, trips, applications, documents, payments, status history, master data, outbox, agencies; RLS | ✅ applied |
| Status machine in the database (+ compare-and-set), SLA 24 h / 72 h, live ping on every change | ✅ all 196 pairs compared with TypeScript |
| `ImmigrationGateway` (HTTP client with error kinds), docket builder, send queue with back-off, callback endpoint, polling fallback, additional documents | ✅ against the simulator; ⬜ against the real Immigration API (needs their specification and credentials) |
| Reference-list sync (+ admin page `/admin/immigration`) | ✅ |
| Encrypted passport numbers and document files, owner/admin-only viewing with audit, retention purge | ✅ needs `DATA_ENCRYPTION_KEY` in Vercel |
| Tick job (queue, polling, list sync, purge) | ✅ |
| Open questions for Immigration (idempotent docket? callback retries? digital pass?) | 🟡 listed in 06-MOCK-PARTNERS.md |

## Phase 2 — Application and payment (weeks 3–6)

⬜ Eligibility check · ⬜ application wizard (package → documents → extras → pay) · ⬜ passport MRZ/OCR + photo quality check · ⬜ flight lookup · ⬜ group applications ·
⬜ checkout with Stripe + local gateway, receipts, reconciliation · ⬜ status timeline + notifications · ⬜ E-VOA Pass (QR, PDF, offline) · ⬜ Ops console (queue, document review, SLA timers) · ⬜ refund rules (Q4)

## Phase 3 — Add-ons (weeks 5–8)

⬜ Insurance · ⬜ SIM/eSIM · ⬜ VIP services · ⬜ Beauty & Health · ⬜ partner API pattern (package list → buy → confirm → callback) · ⬜ add-on rules per airport / package (e.g. not for Express)

## Go-live gate (week 8)

⬜ UAT with Immigration Bureau · ⬜ security audit / pen-test · ⬜ load test · ⬜ PDPA/GDPR review · ⬜ revoke old keys found in legacy documents

## Phase 4+ — Growth

⬜ AI assistant (provider/model routing, prompts and rules) · ⬜ LINE / WhatsApp notifications and quotas · ⬜ automation rules engine (SLA reminders, payment time-outs) · ⬜ Agency / OTA portal · ⬜ Partner portal · ⬜ more languages (HI, AR, RU, KO, JA, ZH-TW) · ⬜ Wallet passes · ⬜ Government/TAT dashboard
