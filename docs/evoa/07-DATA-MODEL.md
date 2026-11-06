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
