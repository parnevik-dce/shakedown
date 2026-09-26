# Data Model (Step 3)

Status: **approved, migration written and tested locally; not yet applied to the Supabase dev project.** SQL: `supabase/migrations/20260926000000_initial_schema.sql`.

Postgres on Supabase. All money is **integer cents** (`bigint`), USD only. Balances are **derived** (views), never stored, so they can't drift.

## Tables

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | One row per user (issue #2). Auto-created by a trigger on `auth.users` insert, so it can't be skipped or duplicated. | `id` (= `auth.users.id`), `display_name`, `avatar_url`, `email` |
| `groups` | Groups **and** trips (BRD: a trip is a group with extra fields). | `id`, `name`, `kind` (`group`\|`trip`), `created_by`, trip-only nullable: `start_date`, `end_date`, `cover_image_path`, `icon` |
| `group_members` | Membership. `left_at` is a soft-leave so past expenses keep their people. | `group_id`, `user_id`, `role` (`owner`\|`member`), `joined_at`, `left_at` |
| `group_invites` | Invite codes/links scoped to one group (#5). | `code`, `group_id`, `created_by`, `expires_at`, `revoked_at` |
| `expenses` | One expense, one payer. | `id`, `group_id`, `description`, `amount_cents` (>0), `paid_by`, `expense_date`, `split_method` (`equal`\|`exact`\|`percent`), `receipt_path`, `created_by`, `updated_at`, `deleted_at` |
| `expense_splits` | Final owed amount per person, in cents. | `expense_id`, `user_id`, `owed_cents` (>=0), `percent` (only for percent splits) |
| `settlements` | A recorded payment between two members (#24). No money moves. | `id`, `group_id`, `paid_by`, `paid_to`, `amount_cents` (>0), `settled_on`, `created_by`, `deleted_at`; `paid_by <> paid_to` |
| `activity_log` | Feed entries (#27/#28), written by triggers so edits/deletes are visible. | `group_id`, `actor_id`, `action` (`expense_added`\|`expense_edited`\|`expense_deleted`\|`settlement_added`...), `entity_id`, `amount_cents`, `created_at` |

## Rules enforced in the database (not just the app)
- `sum(expense_splits.owed_cents) = expenses.amount_cents` (deferred constraint trigger). Exact/percent validation (#12, #13) can't be bypassed.
- **Equal-split remainder:** the app computes the split so leftover cents go to the first N members (e.g. $10.00 / 3 = 334, 333, 333). Stored as final cents, so every view agrees.
- Expenses and their splits are saved through one RPC (`save_expense`) so they commit atomically.
- Delete is a **soft delete** (`deleted_at`) so the feed can show "X deleted Y". Views ignore deleted rows.
- `remove_group_member` RPC refuses when that person's group balance is nonzero (#6).
- `join_group_with_code` RPC (security definer) is the only way to join, so invites stay scoped to one group (#5).

## Balances (derived)
- `group_net_balances` view: per user per group, `paid - owed + settlements_paid - settlements_received`. Positive = owed money.
- `pairwise_balances` view: netted person-to-person amounts per group; summing across groups gives the overall balance (#19/#20) and the "which groups contribute" drill-down.
- Views use `security_invoker` so row-level security applies to them.
- **Debt simplification (#21) is computed in TypeScript**, not stored: unit-testable, and it only reads `group_net_balances`. Greedy matching gives at most n-1 payments. For groups up to ~20 members we can do an exact minimum by finding the most zero-sum subsets. I suggest greedy first and exact as a follow-up.

## Security (row-level security on every table)
- Helper `is_group_member(group_id)`; nearly every policy is "you must be an active member of this group".
- `profiles`: readable by people who share a group with you; writable only by you.
- Only members can create expenses/settlements, and only for their own group.

## Storage
- Private bucket `receipts`, path `{group_id}/{expense_id}.jpg`, access limited to group members, shown via short-lived signed URLs. Limits: images only, 5 MB.
- Private bucket `trip-covers`, same pattern.

## Realtime
Enabled on `expenses`, `expense_splits`, `settlements`, `activity_log` for the live feed and instant balances (#25, #27).

## Decisions (confirmed)
1. **No placeholder members in v1.** People join via invite link.
2. **Only the creator can edit or delete their own expenses** (and delete their own settlements). Enforced in `save_expense` / `delete_expense` / `delete_settlement`, and in storage policies so another member can't overwrite a receipt file. Any member can *view* everything in the group.
3. Any active member can edit trip details.
4. Leaving or removing a member is blocked while any debt involves that person (checked pairwise, so "net zero" isn't enough).
5. Debt simplification: greedy first, exact minimum later.

## Behaviors worth knowing
- Everyone in an expense must be an active member, except when editing an old expense that already includes someone who has since left.
- Invite codes expire after 7 days and can be revoked.
- New expenses accept a client-generated `p_expense_id`, so the receipt can be uploaded to `receipts/{group_id}/{expense_id}.jpg` immediately after saving.
- All writes to expenses, splits, settlements and membership go through RPCs; direct table writes are denied by row-level security.

## How it gets applied
Once approved I'll write it as SQL migrations in `supabase/migrations/`. To apply them to your dev project I need either the Supabase CLI logged in (`supabase login` + `supabase link`, done by you in your terminal) or you paste the SQL into the dashboard's SQL editor. The CLI is better because it gives us repeatable migrations for a future prod project.
