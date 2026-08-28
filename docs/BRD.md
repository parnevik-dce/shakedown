# Business Requirements Document: Shakedown

## Problem
People who regularly share costs — roommates, trips, couples, friend groups — track who-owes-whom manually (spreadsheets, mental math, group chat tallies). This is error-prone and creates friction ("who owes who" arguments, forgotten debts).

## Users
- **Primary:** Individuals in a recurring cost-sharing relationship (roommates, travel groups, couples) who need to log shared expenses and know their current balance with each person.
- **Secondary:** None planned for v1 — no admin/business user role.

## Core Features
1. **Groups** — create a group, invite members (roommates, trip, etc.)
2. **Trips** — a group type with extra metadata: title, start/end dates, icon or cover image
3. **Add expense** — log an expense, assign who paid, split among selected members; attach a receipt image (no OCR — just storage/display)
4. **Split methods** — equal split, exact amounts, percentage split
5. **Balances** — per-person and per-group running balance (who owes whom, how much)
6. **Settle up** — record a payment between two people; user can choose to settle raw balances OR apply **debt simplification** (minimize number of transactions) before settling
7. **Activity feed** — chronological log of expenses/settlements per group

## Scope / Non-Goals
- No multi-currency support — single currency (assumption: USD) for v1
- No in-app payments (no Venmo/PayPal/Stripe integration) — settling up is just a record, not a real money transfer
- No OCR/receipt parsing — image attachment only
- No recurring/scheduled expenses
- No push notifications for v1

## Assumptions
- Users have Google accounts (standard auth default)
- Single currency, no localization needed for v1
- Groups are invite-based (not public/discoverable)
- "Trips" are a variant of groups (same underlying data, extra metadata fields) rather than a separate entity
- Receipt images are stored per-expense, one image per expense

## Risks
- Balance-calculation logic (splits, settlements, edge cases like partial settle-up) is the trickiest part technically
- Debt simplification adds real algorithmic complexity (it's a graph-minimization problem, not just arithmetic) — worth scoping carefully in the data model step
- Receipt image storage needs a plan (Supabase Storage bucket, size limits, upload flow) — will surface in Step 3
- First iOS app: App Store review/provisioning adds a learning curve separate from app logic
- Client framework choice (SwiftUI vs React Native/Expo) isn't locked yet — affects Steps 5+, not this doc

## Success Criteria
- A user can create a group, add 3+ members, log an expense split three ways, and see correct updated balances for each member
- A user can create a Trip with a title, date range, and cover image, and it behaves like a group for expense-tracking
- A user can attach a receipt image to an expense and view it later
- A user can view simplified debts (minimized transaction count) as an alternative to raw balances before settling up
- A user can record a settle-up between two people and see the balance reflect it accurately
- Balances are correct across multiple overlapping expenses in the same group (no drift/rounding errors)
