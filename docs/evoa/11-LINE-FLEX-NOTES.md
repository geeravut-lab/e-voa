# LINE card (Flex Message): how ThaiPass follows `docs/LINE-FLEX-CARD-KNOWLEDGE.md`, and where it differs

Code: `src/lib/messaging/flex.ts` (pure builder) · `src/config/line-colors.ts` (header colors) · `src/lib/messaging/service.ts` (`sendToChannels`) · tests `src/lib/messaging/flex.test.ts` and the LINE card test in `tests-live/phase4.live.test.ts` (the simulator in `tools/mock-partners` refuses a card the way LINE does).

## Followed as written
| Rule in the knowledge file | ThaiPass |
| --- | --- |
| One Flex bubble per message, one button | ✅ |
| Title ≤ 100, summary ≤ 300, label ≤ 24, value ≤ 120, button label ≤ 20, `altText` ≤ 400, at most 8 lines (the summary counts as one) | ✅ every text is cut with "…" (a unit test sends 2,000 characters × 20 lines) |
| `altText` carries the details: "title — summary · label value · …" | ✅ |
| Button opens in the phone's browser: `?openExternalBrowser=1` (appended with `&` when the path already has `?`), no LIFF | ✅ `appOpenUrl` |
| The link is a page of our own site only (`safeHref`: one leading `/`, not `//`, ≤ 300, no backslash/control characters); anything else goes to the home page | ✅ (added after comparing with the file) |
| Text in the recipient's language, app name as set by the administrator | ✅ |
| Nothing sensitive on the card (it shows on the lock screen) | ✅ the card carries reference, status, amount, receipt, item; the **reason** of a rejection or "action needed" is NOT on the card (removed after comparing with the file) |

## Different on purpose
| Knowledge file | ThaiPass | Why |
| --- | --- | --- |
| Title in the body, brand-teal text; coral button | **Colored header by kind of notice** (blue info, green approved, amber needs action or deadline, red rejected or failed, teal payment, purple refund, magenta add-on, navy staff) with the brand and an emoji; the button takes the header's color | The owner asked for it (reference picture). Every header color keeps white text at contrast ≥ 4.5 (tested) |
| Rows are parsed out of one plain-text body (`noticeBody` / `parseNoticeBody`) | Rows are passed as **structured `fields`** (`[label, value][]`) next to the plain `body` | Parsing guesses "label: value" from a sentence and can cut a normal sentence in two (the file's own §8 warning). The in-app notice and the e-mail keep using `body` only |
| Hex colors from the web design file | Hex strings live only in `src/config/line-colors.ts` (the one file allowed by `lint:colors`), because Flex needs hex text | The "no hex outside the token file" rule |
| "No LINE message that does not go through `buildLineMessage`" | If LINE answers HTTP 400 to a card (it can also mean "malformed"), the same notice is sent once as plain text and the channel is **not** stopped. Replies to what a person typed (help text, "Connected") stay plain text | A formatting problem must never cost a notice or switch a person's LINE off |
| Fallback link `/today` | Fallback is `/` (the home page) | ThaiPass has no `/today` |
| Dates in Thai Buddhist-era format | Not used yet: the cards carry no dates | Add when a card needs one (use the recipient's language) |

## Not done (same as the file's "not in the card")
No picture or hero image; no second button; a list longer than 7 rows is cut (the rest is in the app).
