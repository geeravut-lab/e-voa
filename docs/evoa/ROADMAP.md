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
| Sign in: Google, LINE (Aivora), e-mail + password (typed twice when creating; no e-mail needed) | ✅ code · 🟡 Google/LINE need `SUPABASE_SERVICE_ROLE_KEY` etc. in Vercel (see `/api/health`) · forgot-password needs SMTP |
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

## Phase 2 — Application and payment 🟡 (built; card step tested with Stripe TEST API, not through the hosted page)

| Item | Status |
| --- | --- |
| Eligibility page `/eligibility` + admin lists `/admin/eligibility` | ✅ shows "cannot answer yet" until you enter the official lists (nothing is guessed) |
| 4-step wizard `/apply`: trip + package (Regular ≥72 h / Express ≥24 h) → travelers + documents → extras → review and pay; several travelers per trip | ✅ |
| Passport reading: paste/type the 2 MRZ lines, every check digit verified | ✅ · ⬜ camera/photo OCR (planned: self-hosted tesseract, not built) |
| Flight lookup | ✅ with the simulator · ⬜ real provider (`FLIGHT_API_URL`) |
| Document upload (shrunk to Immigration's limits, encrypted), pre-check (passport 180 days, 15-day stay, documents) | ✅ |
| Stripe Checkout (THB, test mode), amount re-checked with Stripe, webhook with signature + de-duplication, receipt numbers, expiry, refunds per policy | ✅ with the Stripe TEST API · 🟡 hosted Checkout page not reachable from the cloud sandbox: please pay once yourself with card 4242 4242 4242 4242 · ⬜ local gateway (later) |
| Status page `/trips`, `/trips/[id]` (timeline, fix and resend, add-on delivery) | ✅ |
| E-VOA pass `/pass`, `/pass/[id]` (signed QR drawn into the page, save as picture for offline, print) and public check `/v/<token>` | ✅ |
| Receipts `/receipts/[id]`, fees and refund rule `/fees` | ✅ |
| Ops console `/admin/queue` (counts, SLA, filters) and detail (documents with audit, notes, request fix, retry send, cancel, exception refund, add-on retry/refund) | ✅ · staff cannot set approved/rejected: only Immigration can |
| Tick: payments reconcile/expire, pre-check recheck, add-on queue, catalogue sync | ✅ (daily on Hobby) |
| Tests: 13 live checks (real Supabase + Stripe TEST + simulator) and 5 browser journeys at 390×844 / 1280×800 pass; 127 unit tests | ✅ |
| Closing items: PDPA consent + signed declaration, receipt PDF + e-mail, e-mail notices, public status check, traveler book, rate limits, error log, passport photo reading (in the browser), photo advice, autosave, full review, cancel / change dates / upgrade, FAQ, checklist, airport guide, official channels, sitemap/robots | ✅ tested: 149 unit, 23 live (Supabase + Stripe test + simulator), 8 browser |
| ✅ Agency uploads (CSV) · ⬜ Ops: bulk actions, assignment, saved filters | next |

## Phase 3 — Add-ons 🟡 (built and tested against the simulator; waits for real partner access)

| Item | Status |
| --- | --- |
| Insurance (policy callback attaches the certificate to the application), SIM, eSIM (LPA + QR), VIP, Beauty & Health (voucher, used, lab result) | ✅ simulator · ⬜ real partners (credentials, signature algorithm) |
| Rules: SIM/VIP only at listed airports and not with Express (admin-editable `addon_rules`) enforced on the server | ✅ |
| Same order never bought twice (`request_ref`), retries with back-off, failure → automatic refund, rejection → unused add-ons refunded | ✅ |
| Public `/extras` catalogue | ✅ |

## Go-live gate (week 8)

⬜ UAT with Immigration Bureau · ⬜ security audit / pen-test · ⬜ load test · ⬜ PDPA/GDPR review · ⬜ revoke old keys found in legacy documents

## Phase 4 — Growth 🟡 (built and tested; waits for real keys)

| Item | Status |
| --- | --- |
| Photo face + background check (in the browser), **selfie with the device camera**, **view any uploaded file** | ✅ tested with a fake camera |
| Language **drop-down**, Thai-themed home banner, **staff see only the back-office menu** (no customer entries), **staff Notifications** `/admin/notifications` (live list of what needs attention, count on the bell), opening a notice **marks it read**, **one-tap "Install as an app"** (Chrome/Edge/Android; iPhone keeps written steps) | ✅ tested in the browser with a simulated install offer · ⬜ try the real install on a phone |
| hreflang (`?lang=`) + SEO articles, tax invoice (PDF, Thai), airport details editable at `/admin/airports` | ✅ · ⬜ legal review of the Thai/Chinese texts and the invoice treatment |
| AI help assistant `/help/chat` (tool use over the user's own application, daily budget, admin switch at `/admin/ai`) | ✅ against the simulator · ⬜ real Claude key (`ANTHROPIC_API_KEY`) |
| **AI providers**: staff choose the provider (Claude or Gemini), the spare and the model of each job at `/admin/ai` (model lists come from the provider, Test button, fallback log without any question text); **AI instructions** `/admin/prompts`: staff append their own guidance after the locked built-in rules, checked by a program then by a small AI (fails closed), every saved text kept in an insert-only history | ✅ against the simulator (Claude and Gemini) · ⬜ real Gemini key (`GOOGLE_AI_API_KEY`) and a real call to each |
| **Immigration simulator on the real site** `/admin/immigration`: while the real connection is not set up, staff switch on a built-in Immigration that takes the queued applications and, from the application page in the queue, approve / reject / ask for more information (only for applications made while it is on; a real connection always wins) | ✅ |
| LINE / WhatsApp notices (link code, signed webhook, quota, blocked accounts) | ✅ against the simulator · ⬜ real LINE / WhatsApp credentials and approved templates |
| Agency portal `/agency` (+ `/admin/agencies`): registration, approval, team, CSV import, discount, commission | ✅ |
| Partner portal `/partner` (+ `/admin/partners`): packages, voucher codes, redeem, settlement CSV, monthly payout record | ✅ |

| **Revenue dashboard** `/admin/revenue`: e-VOA, insurance, SIM, VIP, beauty & health; today / this week / this month / this year / custom range (Thai time); summary, chart, per-category bars, payment list, **CSV export** of the chosen range | ✅ |
| **Automation rules** `/admin/rules`: payment reminder, close unpaid applications (too old or flight landed), reminder to fix, deadline warning and overdue notice for staff; "Run now"; runs in the daily tick | ✅ (the free Vercel plan runs the tick once a day) |

| **Nine languages**: EN, TH, 简体中文 complete; **HI, AR (right-to-left), RU, KO, JA, 繁體中文** translate everything a traveler sees (590 texts each); back-office texts and the long legal / FAQ / guide / article pages show English until written; own fonts; hreflang and sitemap for all nine | ✅ · ⬜ native-speaker review of the six new translations · ⬜ legal texts per language |
| **Partner portal, part 2**: the partner voids an unused voucher (traveler refunded in full through Stripe, both told), limited quantity per package (sold out stops sales, held while the traveler pays), notices to the partner's people (sale, low stock, sold out, void, payout) | ✅ |
| **Agency, part 2**: monthly commission statement (PDF + CSV, Thai/English) per agency, 6 months on `/agency`, any agency for staff; staff record the commission payout once per month at `/admin/agencies`; the agency is notified | ✅ |

| **Google Wallet pass**: "Add to Google Wallet" on the E-VOA pass (approved applications only; QR, reference, arrival, flight, last four passport characters, private-service notice); the link is signed on our server with the service account key | ✅ link and signature tested · ⬜ real Google credentials, publishing access from Google, a real save on a phone |
| **Government / TAT statistics** `/admin/tourism` (staff) and `/gov` (read-only accounts staff add by e-mail): approved arrivals by day, nationality, arrival airport, purpose, gender, age group, length of stay, package; approval rate, decision time, lead time; range filter and CSV export. Counts only, groups under 5 hidden | ✅ |

| **Apple Wallet pass**: "Add to Apple Wallet" on the E-VOA pass (signed `.pkpass`: QR, reference, arrival, flight, last four passport characters, notice; shows on the lock screen near the arrival day); Apple's PassKit web service (`/api/wallet/apple`) so phones fetch newer versions | ✅ file, signature (checked with openssl), web service and push tested with throw-away certificates · ⬜ real Apple certificates, a real install on an iPhone, a real push through Apple |
| **Updates after issue**: the daily tick compares what each handed-out pass shows with the application now; a change is sent to Google (PATCH: shown as not valid when the application is no longer approved) or announced to Apple phones (push) | ✅ against the simulator · ⬜ against real Google / Apple |
| **Connect LINE in numbered steps**: one-time code with **Copy**, **Add friend on LINE** (official add-friend link), **Send the code in LINE** (opens our chat with the code typed), page turns to "Connected" by itself | ✅ tested in the browser with a signed webhook · ⬜ with the real LINE account |
| **Home grids without holes**: a half-width card that would stand alone in a row (before a wide card, or last) becomes full width; order and colours unchanged (admin home and traveler home) | ✅ |
| **/gov shortcut**: a card and menu entry for read-only statistics accounts only; distinct icons for the AI assistant and AI instructions cards | ✅ |

| **E-mail notices**: every status notice also goes by e-mail (in the traveler's language, with a link to switch them off); each person can turn status e-mails off at `/account/notifications` (receipts are always sent); staff see how mail is going on `/admin/messaging` (counts and codes only) | ✅ tested with a fake mail provider · ⬜ `RESEND_API_KEY` and a verified sender domain in Vercel |
| **PDPA: my data** `/account/privacy`: download everything we hold as JSON (passport numbers readable, only to the person); **delete my account**: erases name, contact, passport data, documents, signatures and chat links, blanks the application answers, closes the sign-in for good; payments, receipts, tax invoices and consent records are kept (law); refused while an application or payment is in progress, for staff and for agency/partner owners | ✅ real database, files and sign-in checked · ⬜ legal review of what must be kept and for how long |
| **Discount codes** `/admin/discounts`: percent or fixed baht off the SERVICE fee only (never the government fee or an add-on); dates, total limit, per-person limit; "Apply" at checkout shows the new total; the use is taken when the traveler goes to pay and given back if the payment fails; codes are switched off, never deleted | ✅ with Stripe test mode |
| **Apply again** from an earlier application: same traveler, airports, airline and purpose filled in; dates and flights left empty | ✅ |
| **FAQ and news** `/admin/content`: write questions (EN required, TH and 中文 optional) and news; load the built-in FAQ once to edit it; pinned news shows on the home page; `/news` for visitors; the AI assistant answers from the published English questions | ✅ |
| **Reconciliation** `/admin/reconcile`: every day (Thai time) our paid payments and refunds are compared with Stripe's; differences (Stripe-only, ours-only, amount, refund) are listed with a CSV export, staff are notified, the day stays on the attention list until marked reviewed | ✅ compared with injected Stripe data · ⬜ first run against real Stripe data |

## Still planned

⬜ TAT API / scheduled data feed · ⬜ wallet passes for other states (boarding-style flight reminders) · ⬜ discount codes for add-ons / per-agency codes · ⬜ rich text and images in news
