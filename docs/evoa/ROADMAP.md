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
| ✅ Agency uploads (CSV) · ✅ Ops: bulk actions, assignment, saved filters (see "8 Nov round" below) | done |

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
| **Reconciliation** `/admin/reconcile` (only payments that belong to ThaiPass are compared: the Stripe account may be shared with other apps, so a payment counts as ours when its metadata `payment_id` is one of our payment ids; new checkouts also carry `app=thaipass-evoa`): every day (Thai time) our paid payments and refunds are compared with Stripe's; differences (Stripe-only, ours-only, amount, refund) are listed with a CSV export, staff are notified, the day stays on the attention list until marked reviewed | ✅ compared with injected Stripe data · ⬜ first run against real Stripe data |

| **LINE cards (Flex Message)**: notices reach LINE as a card: colored header by kind (blue info, green approved, amber needs action/deadline, red rejected/failed, teal payment, purple refund, magenta add-on, navy staff), "label | value" rows (reference, status, amount, receipt, item, reason), and one Open button that opens in the phone's browser (`openExternalBrowser=1`); `altText` carries the details for the lock screen; every text is cut to LINE's limits; if LINE refuses a card the same notice is sent as text and the channel is NOT stopped | ✅ checked against a simulator that enforces LINE's limits; compared with `docs/LINE-FLEX-CARD-KNOWLEDGE.md` and aligned (summary line, alt text, safe link, nothing sensitive on the card): see `docs/evoa/11-LINE-FLEX-NOTES.md` · ⬜ with the real LINE account |
| **Own icons for the Revenue and Reconciliation cards** (coins and a banknote with a rising line; two ledgers matched with a check mark) | ✅ |

| **Travel articles from the back office** `/admin/content?kind=article`: write articles (English required, Thai and Chinese optional; `## ` = heading, blank line = paragraph; plain text), a fixed address `/articles/<address>`, summary for the list and search results, date; "Load the built-in articles" copies the five built-in ones into the editor once; published articles replace the built-in list, and the sitemap follows; the FAQ, news and article editors keep what was typed when the server reports a problem (no lost text) | ✅ |
| **Colours and menu for news/articles (7 Nov 2026)**: the news announcement (home banner and `/news`) is light green (`tone-green`); "Travel guides" (`/articles`) has its own home card + sidebar entry right before Notifications, light blue with a new book-and-pin illustration. Nav items can pin their colour (`pin: true`) and the colour spreading works around them | ✅ |

| **8 Nov round (code done; needs the 3 migrations below applied before deploy)**: ✅ the assistant also reads published news and travel guides (bounded, treated as data) · ✅ staff roles manager/operator/finance/editor with capabilities per area (pages, actions, exports, menus, alerts; only the owner manages staff) · ✅ Ops console: assign, bulk (assign / unassign / same note / send again), filters, saved filters · ✅ CI (`.github/workflows/ci.yml`: colours, types, unit tests, build) · ✅ Web Push (VAPID keys, `/account/notifications`) · ✅ new reminders: unpaid application closing, flight near, Stay Guard 7/3/1 days (admin `/admin/rules`) · ✅ pay-later link (traveler signs, someone else pays without an account; 72 h, hashed secret) · ✅ While in Thailand: `/toolkit`, `/emergency` (+ offline copy), `/phrases`, `/check-rules`, `/tdac`, `/stay` · ✅ accessibility check `npm run a11y` (axe, public pages: no serious/critical left) · ✅ AI model drop-down lists every model the provider offers · ✅ news list cards white | ✅ |
| **Migrations to apply (in this order)**: `20261124000100_staff_roles.sql`, `20261124000200_ops_console.sql`, `20261125000100_web_push.sql`, `20261125000200_payment_links.sql`. The code keeps working without the first two (every staff account counts as manager; the queue hides assignment); Web Push and pay-later links need their tables. | ⬜ |

| **8 Nov round 2**: ✅ the 4 migrations are applied to the live database (owner approved) · ✅ pass picture: the saved SVG was invalid (the QR size was written twice, so no viewer opened it) — fixed, and "Save to phone" now gives a PNG (share sheet on phones) · ✅ emergency numbers, Thai phrases and the rules check are edited at `/admin/toolkit` (role editor/manager; stored in settings, built-in lists as fallback; the offline emergency page is built from the same lists) · ✅ safety advisor with live weather and PM2.5: assistant tool `get_conditions`, public page `/conditions` (25 places, "use my location" picks the nearest place in the browser), data from Open-Meteo (credit shown). **Licence:** Open-Meteo's free servers are for non-commercial use; a commercial service needs its paid plan: set `OPEN_METEO_API_KEY`. Official Thai sources (TMD warnings, Air4Thai stations) are the planned upgrade. | ✅ |

| **9 Nov round**: ✅ safety advisor uses OFFICIAL Thai data: PM2.5 from the nearest Air4Thai measuring station (within 40 km, reading under 4 h old; otherwise the modelled value, and the screen says which) and the Thai Meteorological Department's CAP warnings matched to the province (shown in Thai as published; the assistant translates). Formats were checked against the real services on 8 Nov 2026 and are covered by unit tests built from real samples. **Air4Thai's HTTPS certificate chain is incomplete, so the service reads its public JSON over plain HTTP** (range-checked; `AIR4THAI_URL=off` turns it off; `TMD_CAP_URL` overrides the feed). Open-Meteo's free servers returned 429 (daily limit) from our shared IP: a paid plan + `OPEN_METEO_API_KEY` is needed for real use · ✅ incident guides `/incident` (road/motorbike accident, serious illness, lost passport, lost phone/cards, theft, scams, detained, flood/storm/earthquake) editable at `/admin/toolkit` · ✅ rental helper `/rental`: checklist + photos with the time (and position, if allowed) printed on them, kept on the phone only | ✅ |

| **9 Nov round 2**: ✅ "Save to phone" on the E-VOA Pass now downloads the PNG straight away (no share sheet) · ✅ alerts for official weather warnings: a traveler follows up to 5 places on `/conditions` (table `warning_watches`, migration `20261126000100`, applied); when the Thai Meteorological Department has a moderate/severe warning in force for the province, one notice per person and warning goes out by push, LINE and the in-app list (not e-mail). The job runs in the daily tick and, for timely alerts, every 30 minutes from `.github/workflows/warnings.yml` (needs repository secrets `SITE_URL` and `CRON_SECRET`; without them it does nothing) · ✅ offline vault and bilingual health card at `/offline-vault.html`: documents (photo/PDF/notes) and an English+Thai health card stored ONLY on the phone (IndexedDB), encrypted with a passcode (PBKDF2 250k + AES-256-GCM), opens with no network (service-worker copy), auto-locks, erase-all. ThaiPass never receives the contents, so no health data is collected (PDPA review still advisable for the wording) | ✅ |

| **9 Nov round 3**: ✅ family check-in "I am safe" at `/family` (tile on `/toolkit`): up to 5 contacts invited by e-mail with a secret link (only its hash is stored; they accept or leave from the link, no account needed), buttons "I am safe" / "I need help" (a position is kept ONLY when ticked on "help", rounded to ~100 m), an optional schedule (every 6/12/24/48 h, waiting time 1-12 h, end date): the traveler is reminded when a check-in is due and, if still missing after the waiting time, accepted contacts get one e-mail (once per due time, compare-and-set; a later "I am safe" tells them all is well). Check-ins are kept 30 days; the data is in the PDPA download and in account erasure. Tables `safety_contacts/safety_checkins/safety_schedule` (migration `20261127000100`, applied with the owner's OK), job `safety` runs in the tick and every 30 min from `warnings.yml` · ✅ accessibility test of sign-in pages (`tests-live/a11y-signed-in.live.test.ts`: traveler + back-office pages at phone and desktop size; it found and we fixed: low-contrast notification badges, the bell's name not starting with the visible count, 3 wide tables not reachable by keyboard) | ✅ |

| **9 Nov round 4**: ✅ Ops queue: the "Selected applications" card no longer covers the screen. Nothing ticked → one slim row with "Select all"; something ticked → ONE compact bar stuck to the bottom (count, action, extra field, apply, clear; about 62 px on desktop, 110 px on a phone instead of about 350 px), and the result message sits on the same row | ✅ |

| **10 Nov round**: ✅ the traveler toolkit and the queue are translated into HI, AR (right-to-left), RU, KO, JA, ZH-TW: family check-in page and e-mails, emergency numbers, phrase meanings, rules check, TDAC helper, Stay Guard, incident guides, rental helper, weather/air advice and labels (`src/lib/content/lang/<code>-a.ts` / `-b.ts`), and the 74 queue texts of the Ops console (`src/lib/i18n/dict/ops-<code>.ts`). A test (`lang.test.ts`) fails if any item, key or {placeholder} is missing in any of the six. Back-office note: the `/admin/toolkit` form edits English, Thai and Chinese only; a built-in item the staff did not change keeps its six translations, a rewritten one shows English in those six until a translation is added in code | ✅ |

| **10 Nov round, news**: ✅ rich text and pictures in news (`/admin/content?kind=news`, shown on `/news`): `## heading`, `**bold**`, `*italic*`, `[link](https://…)`, lists, `>` highlighted note, divider, and an **Add picture** button (PNG/JPG/WebP up to 6 MB; checked by content, shrunk to 1600 px, re-saved as WebP which also removes camera data such as GPS; stored in the existing private `brand-assets` bucket under `news/`, served by `/news-img/<random name>`, so **no database change**). Text is never run as HTML (a small parser → React elements; only http(s), mailto and in-site links; only our own picture addresses), a toolbar and a preview in the editor, the home banner and the AI assistant read the plain text, old plain-text news still shows with its line breaks, and deleting a news item removes pictures nothing else uses. Tests: `rich.test.ts` (parser, unsafe links, HTML as text) and `tests-live/news-rich.live.test.ts` (real Storage) | ✅ |

| **10 Nov round, infographic**: ✅ the infographic (`docs/evoa/infographic/ThaiPass-eVOA-infographic-{EN,TH}-{1,2,3}.png`, 3 pages each, system colours, the app's own illustrations) now covers everything built so far: the 4-step flow, safety companion (emergency numbers and Thai phrases, incident guides, weather/air/official warnings with phone alerts, rules check, TDAC and Stay Guard, motorbike rental helper, offline vault and health card, family check-in, AI assistant, airport guide), add-ons, prices and refunds, pay-later links, privacy (download/erase), nine languages, agencies and partners, and the back office (roles, bulk actions, audit trail, news with pictures). Rebuild: `npx vite-node tools/infographic/art.tsx /tmp/art.json` then `node tools/infographic/build.mjs /tmp/art.json <out-dir> .` | ✅ |

| **10 Nov round, home news card**: ✅ the pinned news card on the home page shows the title in at most 2 lines and the text in at most 3 lines, whatever the screen width (the old 2-line limit did not work: the `block` class overrode the clamp, so the whole text showed — measured 9 lines at 320 px before, 3 now). Only ONE pinned item is shown: the most recently published pinned news; other pinned items are listed on `/news` | ✅ |

## Still planned

⬜ TAT API / scheduled data feed · ⬜ wallet passes for other states (boarding-style flight reminders) · ⬜ discount codes for add-ons / per-agency codes
