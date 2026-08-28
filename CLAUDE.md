# Shakedown

iOS expense-splitting app (Splitwise-style) — roommates, trips, couples, friend groups.

See @docs/BRD.md for the confirmed requirements, scope, and assumptions.

## Process

This project follows the `webapp-starter` skill's 9-step process (BRD → GitHub Issues → data model → wireframes → repo scaffold → dev loop → auth → deploy → testing loop). Continue from whichever step is incomplete rather than restarting.

Current status:
- [x] Step 1 — BRD confirmed (see @docs/BRD.md)
- [x] Step 2 — Requirements written up as 31 GitHub Issues (see `create_issues.sh` / the repo's Issues tab)
- [ ] Step 3 — Data model / schema — next up
- [ ] Step 4 — Wireframes (Claude Design)
- [ ] Step 5 — Repo scaffold
- [ ] Step 6 — Development loop
- [ ] Step 7 — Auth
- [ ] Step 8 — Deploy
- [ ] Step 9 — Testing loop

## Stack

- Backend/DB: Supabase (Postgres)
- Auth: Google OAuth via Supabase Auth
- Client: **iOS native app** — this is a deviation from the webapp-starter skill's default of Next.js + Vercel, since that default targets web apps. Framework choice (SwiftUI vs React Native/Expo) not yet locked — decide before Step 5 (repo scaffold), since it changes scaffold/deploy steps.
- Issue tracking: GitHub Issues (created via `gh` CLI — see `create_issues.sh`)

## Notes

- Debt simplification (minimize transaction count on settle-up) is in scope for v1 and is the highest algorithmic-complexity feature — give it careful attention in the data model step.
- Receipt images: storage/display only, no OCR, one image per expense.
- Single currency (USD) for v1, no push notifications for v1.
