# Partner simulator (`tools/mock-partners`)

A small Node server (no dependencies) that behaves like the outside systems ThaiPass talks to, so every flow can be developed and tested without them.
It follows the flows and field names in `TieThai & WeGoThiland Documents/Flow & API Docs`, adapted to ThaiPass (JSON everywhere, one callback address per partner).

```bash
npm run mock                      # http://localhost:4010
npm test                          # includes the simulator's own tests (tools/mock-partners/mock.test.mjs)
npm run e2e:phase1                # live checks: real Supabase + simulator (see below)
```

Point the app at it: `IMMIGRATION_API_URL=http://localhost:4010/immigration/th/v1`, any `IMMIGRATION_API_TOKEN` and `IMMIGRATION_API_FROM`.
To receive decisions, give the simulator the app's callback address: `POST /__admin/config {"callbacks":{"immigration":"http://localhost:3000/api/immigration/callback"}}`
and set `MOCK_CALLBACK_SECRET` to the same value as `IMMIGRATION_CALLBACK_SECRET`.

## What it simulates

| System | Paths | Behaviour |
| --- | --- | --- |
| **Immigration** (ICD v1.2.5) | `/immigration/th/v1/master/{name}[/{id}]`, `POST application/docket`, `GET application/getStatusById`, `GET application/getEVOAById`, `POST application/uploadAdditionalDocuments`; calls back `updateStatusById` | Checks every required field, lengths, date/time formats, 6–8 documents, JPEG/PDF only, ≤ 100 KB photo / ≤ 1 MB others, 1–5 additional documents. Decides after `MOCK_DECISION_DELAY_MS` |
| **Insurance (CIS)** | `POST /insurance/CIS/travelPAPolicyIssueService`, calls back `Confirm_COI` with the e-card | Needs `g-api-key` + Bearer; validation errors in the documented shape |
| **SIM / eSIM** | `GET /sim/wechat/package_list`, `POST /sim/SIM/TRUE/sim_buy`, event `sim_confirm` | Physical SIM needs the passport bio image; eSIM (`ESIM-015`) returns an LPA string and QR URL (new for ThaiPass) |
| **VIP services** | `GET /vip/wechat/package_list`, `POST /vip/Services/VIP/vip_buy`, event `vip_confirm` | |
| **Beauty & Health** | `GET /bhs/wechat/package_list`, `POST /bhs/wechat/gen_health_voucher`, `POST /bhs/wechat/voucher/verify`, events `confirm_voucher`, `callback_result` | Voucher states VALID / USED / INVALID |

Partner calls are signed with `timestamp`, `key` and `X-API-KEY = HMAC-SHA256(secret, timestamp)` (hex). **This signature is our assumption**: the original documents describe it with a picture we cannot read. Confirm the real algorithm with each partner. Defaults: secret `mock-secret`, key `mock-public`.

Point the app at the add-on simulators: `PARTNER_INSURANCE_URL=http://localhost:4010/insurance/CIS`, `PARTNER_SIM_URL=http://localhost:4010/sim`, `PARTNER_VIP_URL=http://localhost:4010/vip`,
`PARTNER_BHS_URL=http://localhost:4010/bhs`, `INSURANCE_G_API_KEY`/`INSURANCE_TOKEN` any value, `PARTNER_SECRET=mock-secret`, `PARTNER_PUBLIC_KEY=mock-public`, `FLIGHT_API_URL=http://localhost:4010`.
Partner callbacks go to `/api/partners/<provider>/<original path>` with `Authorization: Bearer <PARTNER_CALLBACK_SECRET>` (give the simulator `MOCK_CALLBACK_INSURANCE=http://localhost:3000/api/partners/insurance`, and the same for `sim`, `vip`, `bhs`).

## Choosing the Immigration outcome (end of the passport number)

| Passport ends with | Result |
| --- | --- |
| `…APR` or anything else | Approved after the delay, E-VOA sent by callback |
| `…REJ` | Rejected: "Blacklist match (simulated)" |
| `…UPD` | "Need update" (hotel picture); approved after `uploadAdditionalDocuments` |
| `…SLOW` | No decision until `POST /__admin/decide {webReferenceNumber, statusId, statusDesc}` |
| `…DOWN` | The docket call answers 503 |
| `…ERR` | The docket call answers 500 once, then works |
| `…BAD` | The docket is refused with a reason in `failedList` |

Controls: `GET /__admin/state` · `POST /__admin/reset` · `POST /__admin/config {decisionDelayMs, duplicateMode: "idempotent"|"reject", callbacks:{…}}` ·
partner-side events `POST /__admin/partner/{sim-confirm|vip-confirm|bhs-confirm|bhs-result}`.

## Rule for development

Whenever something that touches Immigration or a partner is built or changed, **test it against this simulator first** (add the scenario here if it is missing), and keep the live checks green. The simulator must never be pointed at production data, and its reference lists must never stay in the real database (the live suite deletes them).

## Open questions for Immigration and partners (the simulator had to assume an answer)

1. Is `docket` idempotent for the same `paymentReceiptRefNumber`? (simulator: yes; set `duplicateMode: "reject"` to test the other case.) The answer decides how safely a timed-out submission can be retried.
2. Does Immigration retry a callback when we answer non-2xx? (we answer 503 only when the application is in flight but not yet matched.)
3. Can the E-VOA be digital only, with a QR/verification link, or must it stay printable? (Q8)
4. The partner request signature (above).

## Phase 2/3 live checks (`tests-live/phase2.live.test.ts`)

Real Supabase + real **Stripe TEST** API + this simulator: catalogue and rules, flight lookup, incomplete order refused, add-ons chosen server-side, a real Stripe Checkout Session with the exact total
(unpaid = not paid), a real test PaymentIntent recorded through `mark_payment_paid` (the hosted Checkout page cannot be reached from the cloud sandbox, so the card step itself is **not** driven),
receipt number, insurance callback → document attached → Immigration → E-VOA → signed pass token, RLS, refunds through Stripe (policy, double refund, cap), rejection refunds only unused add-ons,
partner outage → retries → failed → refunded, unpaid order expiry. It removes everything it created.

## Phase 4 endpoints (`tests-live/phase4.live.test.ts`)

- `POST /ai/v1/messages`: Anthropic Messages API (accepts `x-api-key` and `Bearer`), answers with tool calls then text so the assistant loop is exercised; state `aiRequests` records model, system prompt, tools and `output_config`.
- `/line/v2/bot/message/push|reply`, `/whatsapp/v<version>/<phone>/messages`: record what would be sent in `messagesSent`; a LINE user id ending in `BLOCKED` answers 400 (the user blocked us) to test the "stop trying" path.
- The partner portal needs no simulator: portal-managed partners are not called (the voucher is issued inside ThaiPass).
