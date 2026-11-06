# ThaiPass e-VOA — rules for Claude working in this repo

Product: Thailand Visa-on-Arrival (e-VOA) web app for travelers of every nationality. Stack: Next.js 16 (App Router) + Supabase (Auth, Postgres, Storage, Realtime) deployed on Vercel at https://e-voa.vercel.app.
Docs: `docs/evoa/README.md` (index) · `docs/evoa/ROADMAP.md` (phases and status) · `docs/Knowledge-Index.md` (reusable knowledge from RooSuk).

## Working rules set by the owner (must follow every time)

1. **After every prompt is finished, end the reply with "Next steps"**: what remains in the current phase and in the next phase (from `docs/evoa/ROADMAP.md`), as a short numbered list the owner can pick from. Update ROADMAP.md in the same change. Do not start those steps until the owner chooses.
2. **Every button, menu item and link shows a spinner while it is working**, and the spinner goes away when the work ends. Use `SubmitButton` (forms), `AsyncButton` (click handlers), `AppLink` / `NavRowLink` (navigation). Never add a bare `<button>`/`<form>` that does slow work without one of these.
3. **Never expose secrets**: `SUPABASE_SERVICE_ROLE_KEY` and other server keys never get a `NEXT_PUBLIC_` prefix and are used only in server code. Never write a key into a file, doc or commit.
4. **All UI text goes through the dictionaries** (`src/lib/i18n/dict/*`). Server code returns `err_*` codes; the screen turns them into sentences. EN, TH, ZH-CN are required; adding a language = see `src/lib/i18n/langs.ts`.
5. **One menu source**: `src/config/nav.ts`. Sidebar, bottom bar, More sheet and home cards all come from it.
6. **Admin pages call `requireAdminPage()`; admin actions call `requireAdminAction()` on their first line.** Hiding a menu is not access control.
7. **A write that matches no row is not success.** Count the rows returned (`.select("id")`) for important writes.
8. **Never record something as passed that has not been checked** (payments, documents, approvals): keep a real "pending" state.
9. Fail open for settings: if a setting/flag cannot be read, use the default in code and keep working.
10. Brand name, logo and favicon come from `/brand/logo`, `/brand/favicon` and `getT().brandName`. Never hard-code them in components.
11. Do not copy API keys or tokens found in the legacy documents (`TieThai & WeGoThiland Documents/`) into code or docs.

12. **Supabase operations** (when the environment has the Supabase hosts allowed and a token injected): use the Management API (`https://api.supabase.com/v1/projects/<ref>/…`) for SQL and Auth settings. Never print or store a key; read-only checks first; ask the owner before anything destructive (DROP, DELETE, truncating, changing Auth on production) or irreversible. Test with a temporary user and delete it (`npm run e2e:supabase`).
14. **Test with the simulator**: whenever something touches Immigration, insurance, SIM/eSIM, VIP or Beauty & Health, build or extend the scenario in `tools/mock-partners` (flows and API docs: `TieThai & WeGoThiland Documents/Flow & API Docs`, adapted to ThaiPass) and test against it first. Keep `npm test` and `npm run e2e:phase1` green. See `docs/evoa/06-MOCK-PARTNERS.md`.
15. **Cleaning up test data on the real project**: tests delete only what they created, in the same run. Any other bulk deletion needs the owner's explicit OK first. Simulator data (reference lists) must never stay in the real database. **Exception approved by the owner (2026-11-06):** the simulator's small reference lists are loaded as SAMPLE data (`master_data.extra.sample = true`, flagged on `/admin/immigration`) so the wizard can be tried before Immigration is connected; the first real sync from Immigration replaces them. Do not take real applications while they are loaded.
13. **Realtime client**: create it with the `accessToken` option and `await realtime.setAuth(token)` before subscribing. The default auth layer closed a lone private channel in testing.

## Commands

```bash
npm run dev         # local development
npm run typecheck   # tsc
npm test            # vitest (pure logic: i18n, brand, live-sync rules, SSO payload, safe redirects)
npm run build       # production build
npm run mock          # partner simulator on :4010
npm run e2e:phase1    # Phase 1 live checks (real Supabase + simulator)
npm run lint:colors   # no hex colors outside globals.css
npm run e2e:supabase  # live check of the Supabase project (needs SB_URL, SB_ANON, SB_SERVICE in the environment)
```

Before saying a change is done: typecheck, tests and build pass; for UI changes look at it at 390×844 and 1280×800.
