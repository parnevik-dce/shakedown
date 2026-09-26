# Shakedown

iOS expense-splitting app (Splitwise-style) — roommates, trips, couples, friend groups.

See @docs/BRD.md for the confirmed requirements, scope, and assumptions.

## Process

This project follows the `webapp-starter` skill's 9-step process (BRD → GitHub Issues → data model → wireframes → repo scaffold → dev loop → auth → deploy → testing loop). Continue from whichever step is incomplete rather than restarting.

Current status:
- [x] Step 1 — BRD confirmed (see @docs/BRD.md)
- [x] Step 2 — Requirements written up as 30 GitHub Issues (see the repo's Issues tab)
- [ ] Step 3 — Data model / schema — next up
- [ ] Step 4 — Wireframes (Claude Design)
- [x] Step 5 — Repo scaffold (Expo SDK 57 / React Native, TypeScript)
- [ ] Step 6 — Development loop
- [x] Step 7 — Auth (Google OAuth via Supabase verified in iOS Simulator; profile creation, issue #2, waits on schema)
- [ ] Step 8 — Deploy
- [ ] Step 9 — Testing loop

## Stack

- Backend/DB: Supabase (Postgres)
- Auth: Google OAuth via Supabase Auth
- Client: **iOS native app** — this is a deviation from the webapp-starter skill's default of Next.js + Vercel, since that default targets web apps. Framework: **Expo / React Native** (locked). Read the versioned Expo docs per AGENTS.md before writing code.
- Issue tracking: GitHub Issues (created via `gh` CLI)

## Dev setup

- Config in `.env` (gitignored; see `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable key). Never put secret/service_role keys in the app.
- Native dev client (Expo Go can't handle the OAuth redirect): `npx expo run:ios`, then `npx expo start --dev-client`. `ios/` is generated and gitignored.
- If `pod install` fails with a Unicode error, set `LANG=en_US.UTF-8`.
- Bundle ID `com.parnevik.shakedown`, URL scheme `shakedown`. Google OAuth redirects through Supabase's `/auth/v1/callback`; `shakedown://` must be in Supabase's Redirect URLs.
- Apple Developer Program ($99/yr) is not needed until Step 8 (TestFlight/App Store). Sign in with Apple is required before App Store submission because we offer Google sign-in.

## Notes

- Debt simplification (minimize transaction count on settle-up) is in scope for v1 and is the highest algorithmic-complexity feature — give it careful attention in the data model step.
- Receipt images: storage/display only, no OCR, one image per expense.
- Single currency (USD) for v1, no push notifications for v1.
