# Data model and rules (Phase 1)

SQL: `supabase/migrations/20261106000100_foundation.sql` and `…000200_phase1_core.sql` (both idempotent). Applied to project `ytzktizvmeayugdfzzlk`.

```
auth.users ─┬─ profiles                       (language, name)               travelers ──┐
            ├─ travelers  (passport encrypted)                                trips ─────┼─► applications ─┬─► application_status_history (append-only)
            ├─ trips                                                          payments ──┘                 ├─► documents ──► Storage bucket "documents" (encrypted files)
            ├─ app_notifications  ──► live ping "u:<user>"                    agencies (ready)             └─► immigration_outbox (retry queue)
            └─ admins / audit_log / product_events / platform_settings / master_data / master_sync / aivora_links
```

## Application status (enforced in the database)

```
draft → awaiting_payment → paid → pre_check → submitted → under_review → approved → used | no_show
                │             │       │  │         │           │
                ▼             ▼       │  │         ├→ rejected │→ rejected
             expired      cancelled   │  └→ submission_failed ←─┘ (retry → submitted)
                                      └→ action_required ⇄ (traveler fixes → pre_check / under_review)
```

- Status changes ONLY through `transition_application()` (service role): it checks the allowed move, writes `application_status_history`, sets the 24 h / 72 h SLA when paid, and pings the owner's and the admins' live channels.
- A direct `UPDATE … SET status` fails with `err_status_locked`; new rows must be `draft`.
- `p_only_from` makes a change conditional ("only if still pre_check"): a slow bookkeeping step can never undo a decision that arrived first.
- The same table is in `src/lib/applications/state.ts`; the live test compares all 196 pairs against the database.
- "Sent" is only recorded when Immigration accepted the application. An outage keeps it in `pre_check` (retry with back-off 1, 5, 15, 60, 180 min), and after 6 attempts it becomes `submission_failed`.

## Who can read and write

| Table | Traveler | Admin | Server (service role) |
| --- | --- | --- | --- |
| profiles, travelers, trips | own rows (read and write) | read | all |
| applications, history, payments | own rows, read only | read | all (status via the function) |
| documents | own, not deleted, read only | read | all |
| master_data | everyone reads | | write |
| immigration_outbox, payment_events, aivora_links | nothing | | all |

## Protecting personal data

- Passport numbers: AES-256-GCM (`src/lib/crypto.ts`) + a keyed hash for duplicate detection + the last 4 characters for display.
- Document files: encrypted by the server before upload into a private bucket; read through `/api/documents/{id}` which decrypts for the owner or an admin only; an admin opening someone else's document writes `document.view` to the audit trail; a checksum mismatch means the file is not shown.
- Retention: `documents_due_for_purge` + `purgeExpiredDocuments`, run by the daily tick, using the admin-set number of days (default 90) after the arrival date; loose uploads are removed after 7 days.
- The key `DATA_ENCRYPTION_KEY` is a server secret. **Back it up: without it the passport numbers and files cannot be read.** Key rotation is supported by the version byte in the format (not implemented yet).

## Immigration link

`src/lib/immigration/`: `schema.ts` (ICD fields) · `gateway.ts` (HTTP client, error kinds, GET retries) · `docket.ts` (builds the docket from the database, validates before sending) ·
`pipeline.ts` (queue, send, callback, polling fallback, additional documents) · `sync.ts` (reference lists). The decision comes back at `POST /api/immigration/callback`
(Bearer `IMMIGRATION_CALLBACK_SECRET`); if a callback arrives before our bookkeeping, it is matched by batch id; repeated callbacks are applied once.

## Phase 2/3 tables (migration `20261107000100/200`)

| Table | What | Who sees it |
| --- | --- | --- |
| `payments` (+ `receipt_no`, `items`, `provider_payment_ref`, `trip_id`, `expires_at`) | One payment per trip checkout; `items` is the frozen list of what was bought; `mark_payment_paid()` sets paid exactly once and gives `RC-YY-000001` | owner, admin |
| `refunds` | Every refund (kind `addon` = policy, `exception` = decided by staff) with Stripe's id and status | owner, admin |
| `partner_packages` | Local copy of what partners sell (insurance plan, SIM, eSIM, VIP, health) | everyone (active rows) |
| `addon_orders` | One row per add-on per application; `request_ref` is OUR id sent to the partner so the same order is never bought twice; `partner_ref`, `delivery` (e-card, LPA/QR, voucher) | owner, admin |
| `application_notes` | Staff notes, never shown to travelers | admin |
| `trips.package` | The package is chosen in step 1 and copied to every application of the trip | owner |

Settings keys added: `eligibility`, `required_documents`, `addon_rules`, `insurance`, `refund_policy`.

## Phase 4 tables (migrations `20261109…` to `20261112…`)

| Table / column | What | Who sees it |
| --- | --- | --- |
| `tax_invoices` (+ `company` setting) | Tax invoice per payment (company details from `/admin/company`), numbering, PDF | owner, admin |
| `ai_usage` | Requests and tokens per day for the assistant budget | admin |
| `notification_channels`, `message_log` | Linked LINE / WhatsApp accounts (with one-time codes) and a log used for the monthly quota | owner (own rows), admin |
| `agencies` (+ terms, contact), `agency_members`, `applications.agency_id`, `trips.agency_id`, `documents.agency_id` | B2B accounts, team, the private registration document | members (own membership), admin |
| `partners`, `partner_members`, `partner_settlements` | Portal partners, their staff, one paid-out settlement per partner and month | admin; members read their own membership and payouts |
| `partner_packages.partner_id/source` | `source = 'portal'` rows belong to a partner and are never touched by the API catalogue sync; visible only while the partner is active (`partner_is_active()`) | everyone (active rows) |
| `addon_orders.partner_id/settlement_id` | Who delivers an order and which payout covered it; `partner_ref.portal_code` is the unique voucher code | owner, admin |
| `admin_alert_seen` (migration `20261113…`) | Which back-office alerts each administrator has opened (by alert key and signature) | that administrator |
| `platform_settings.audit_config` | `{ enabled, disabled[] }`: whether and which groups of events the audit trail records | admin |
| `partner_packages.stock_total` (migration `20261114…`) | Quantity limit of a portal package (null = unlimited); column not readable by travelers or visitors | partner, admin |
| `agency_payouts` (migration `20261115…`) | One commission payout per agency and month (frozen numbers, statement number) | the agency, admin |
| `platform_settings.automation_rules`, `automation_last_run` | Rules engine settings and the last run | admin |

## Government / TAT statistics

- `report_viewers (user_id, added_by, created_at)`: accounts that may open `/gov` (read-only statistics). RLS: a viewer reads their own row, staff read all. Written by the server only.
- `tourism_stats(p_from date, p_to date) → jsonb`: counts only (funnel by status, approved arrivals by day / nationality / airport / purpose / gender / age band / stay band / package, average decision hours, average lead days). Executable by `service_role` only; the server checks who is asking. The app hides every group under 5 (`src/lib/tourism/stats.ts`).
