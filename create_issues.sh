#!/usr/bin/env bash
# Shakedown — bulk-create requirements as GitHub Issues
# Usage:
#   1. Install gh CLI if you don't have it: https://cli.github.com
#   2. Authenticate: gh auth login
#   3. Run this script from anywhere: bash create_issues.sh
set -e

REPO="parnevik-dce/shakedown"

create_feature() {
  local title="$1"
  local description="$2"
  local why="$3"
  local criteria="$4"
  local data_model="$5"

  gh issue create --repo "$REPO" \
    --title "[Feature] $title" \
    --label "feature" \
    --body "**Description**
$description

**Why**
$why

**Acceptance Criteria**
$criteria

**Data model touched**
$data_model (preliminary — will be finalized in Step 3)

**Notes**
"
}

# --- Auth ---

create_feature "Google OAuth sign-in" \
"User signs in with their Google account via Supabase Auth." \
"Standard auth entry point for all users; BRD assumption of Google accounts." \
"- [ ] Tapping Sign In opens Google OAuth flow
- [ ] Successful auth returns user to app, signed in
- [ ] Failed/cancelled auth shows an error, no crash" \
"users"

create_feature "User profile creation on first sign-in" \
"On a user's first sign-in, create their profile record (name, avatar, email) from Google account data." \
"Every other feature depends on a user record existing." \
"- [ ] First sign-in creates a row in users table
- [ ] Name/avatar/email populated from Google profile
- [ ] Subsequent sign-ins do not duplicate the profile" \
"users"

create_feature "Sign out" \
"User can sign out of the app." \
"Basic account control." \
"- [ ] Sign out clears session
- [ ] User is returned to sign-in screen" \
"users (session only)"

# --- Groups ---

create_feature "Create a group" \
"User creates a group with a name and adds members." \
"Core organizing unit for shared expenses." \
"- [ ] User can name a group
- [ ] User can add members at creation or after
- [ ] Group appears in user's group list" \
"groups, group_members"

create_feature "Invite members to a group" \
"Existing group member can invite others via link or code." \
"Groups need a way to grow without manual backend work." \
"- [ ] Invite link/code can be generated
- [ ] Opening the invite lets a new user join the group
- [ ] Invite is scoped to one group" \
"groups, group_members"

create_feature "Leave or remove a group member" \
"A member can leave a group; an existing member can remove another." \
"Groups change membership over time (roommate moves out, etc.)." \
"- [ ] User can leave a group they belong to
- [ ] Removing a member with a nonzero balance is blocked or flagged
- [ ] Group member list updates immediately" \
"group_members"

create_feature "View list of groups" \
"User sees all groups/trips they belong to." \
"Primary navigation entry point." \
"- [ ] List shows all groups user is a member of
- [ ] Each entry shows name and (if Trip) date range/cover image
- [ ] Empty state shown if user has no groups yet" \
"groups, group_members, trips"

# --- Trips ---

create_feature "Create a Trip" \
"User creates a Trip: a group variant with title, start/end dates, and a cover icon or image." \
"BRD requirement: trips need distinct metadata from generic groups." \
"- [ ] Trip creation form includes title, start date, end date, cover image/icon
- [ ] Trip is created as a group with trip-specific fields populated
- [ ] Trip appears in the groups list with its metadata visible" \
"groups, trips"

create_feature "Edit Trip metadata" \
"User can edit a Trip's title, dates, or cover image after creation." \
"Trip details change (dates shift, better cover photo, etc.)." \
"- [ ] Trip owner/member can edit title, dates, cover image
- [ ] Changes save and reflect immediately in group list" \
"trips"

# --- Expenses ---

create_feature "Add an expense" \
"User logs an expense: amount, description, date, payer, and which group it belongs to." \
"Core action of the app — every other feature depends on expenses existing." \
"- [ ] Form captures amount, description, date, payer, group
- [ ] Expense saves and appears in group's expense list
- [ ] Validation prevents zero/negative amounts" \
"expenses"

create_feature "Split expense equally" \
"User splits an expense evenly among selected group members." \
"One of three required split methods from the BRD." \
"- [ ] User selects which members are included in the split
- [ ] Amount divides evenly (handle remainder cents correctly)
- [ ] Split reflected correctly in each member's balance" \
"expenses, expense_splits"

create_feature "Split expense by exact amount" \
"User assigns a specific dollar amount to each person for an expense." \
"One of three required split methods from the BRD." \
"- [ ] User enters exact amount per selected member
- [ ] Sum of entered amounts must equal total expense (validation)
- [ ] Split reflected correctly in balances" \
"expenses, expense_splits"

create_feature "Split expense by percentage" \
"User assigns a percentage of the expense to each person." \
"One of three required split methods from the BRD." \
"- [ ] User enters percentage per selected member
- [ ] Percentages must sum to 100% (validation)
- [ ] Split reflected correctly in balances" \
"expenses, expense_splits"

create_feature "Attach receipt image to expense" \
"User can attach a photo/image of a receipt to an expense. No OCR — image storage/display only." \
"Explicit BRD requirement added by user." \
"- [ ] User can attach an image when creating or editing an expense
- [ ] Image uploads to storage and is linked to the expense
- [ ] Image can be viewed later from the expense detail" \
"expenses, receipts (or expenses.receipt_url)"

create_feature "View receipt image full-screen" \
"User taps a receipt thumbnail to view it full-screen." \
"Attaching a receipt is only useful if it's viewable." \
"- [ ] Tapping receipt thumbnail opens full-screen view
- [ ] User can dismiss back to expense detail" \
"receipts"

create_feature "Edit an expense" \
"User can edit an existing expense's amount, description, date, payer, or split." \
"Corrections happen constantly (typo'd amount, wrong payer, etc.)." \
"- [ ] All expense fields are editable
- [ ] Editing recalculates balances
- [ ] Edit is reflected in the activity feed" \
"expenses, expense_splits"

create_feature "Delete an expense" \
"User can delete an expense." \
"Expenses are sometimes added by mistake." \
"- [ ] Deleting an expense removes it and its splits
- [ ] Balances recalculate immediately
- [ ] Deletion is reflected in the activity feed" \
"expenses, expense_splits"

# --- Balances ---

create_feature "Calculate per-person balance within a group" \
"Real-time calculation of who owes/is owed within a single group." \
"Core value proposition of the app." \
"- [ ] Balance updates immediately when an expense is added/edited/deleted
- [ ] Balance is correct across overlapping expenses (no drift/rounding errors)
- [ ] Balance is visible per group" \
"expenses, expense_splits, settlements"

create_feature "Calculate overall per-person balance across groups" \
"Real-time calculation of a user's total balance with another person across all shared groups." \
"BRD success criteria requires cross-group balance accuracy." \
"- [ ] Overall balance sums correctly across all shared groups
- [ ] Updates immediately when any contributing expense changes" \
"expenses, expense_splits, settlements"

create_feature "Balance summary screen" \
"Screen showing who owes the user and who the user owes, at a glance." \
"Primary \"check my balance\" screen users will return to often." \
"- [ ] Lists all people with a nonzero balance
- [ ] Clearly distinguishes owed-to-you vs you-owe
- [ ] Tapping a person shows the group(s) contributing to that balance" \
"expenses, expense_splits, settlements"

# --- Debt Simplification ---

create_feature "Compute simplified debt graph" \
"Given a group's raw balances, compute the minimum set of payments that clears all debts." \
"Explicit BRD requirement added by user; core differentiator vs. raw balances." \
"- [ ] Algorithm outputs minimum transaction count that resolves all balances
- [ ] Output is mathematically correct (sums to zero net per person)
- [ ] Performance acceptable for groups up to ~20 members" \
"expenses, expense_splits (computed, not stored)"

create_feature "Toggle raw vs. simplified balance view" \
"User can switch between raw balances and the simplified debt view before settling." \
"Explicit BRD requirement — user chooses before settling up." \
"- [ ] Toggle control visible on balance/settle screens
- [ ] Switching views does not alter underlying data, display only" \
"n/a (view logic only)"

create_feature "Simplified view feeds into settle-up flow" \
"When settling up from the simplified view, the suggested payment pairs/amounts are pre-filled." \
"Otherwise the simplification is just informational, not actionable." \
"- [ ] Starting settle-up from simplified view pre-fills payer/payee/amount
- [ ] User can still adjust before confirming" \
"settlements"

# --- Settle Up ---

create_feature "Record a settlement payment" \
"User records a payment made between two people (amount, date)." \
"This is how balances actually get cleared — no real money moves through the app." \
"- [ ] User selects payer, payee, amount, date
- [ ] Settlement saves and is linked to the relevant group
- [ ] Settlement cannot be negative or zero" \
"settlements"

create_feature "Settlement updates balances immediately" \
"Recording a settlement recalculates and reflects updated balances right away." \
"Balances must never be stale after a settle-up." \
"- [ ] Balance reflects the settlement immediately after recording
- [ ] Reflected consistently across group and overall balance views" \
"settlements, expenses, expense_splits"

create_feature "View settlement history per group" \
"User can see a list of past settlements within a group." \
"Transparency — same reasoning as the activity feed requirement." \
"- [ ] List shows all settlements for a group, most recent first
- [ ] Each entry shows payer, payee, amount, date" \
"settlements"

# --- Activity Feed ---

create_feature "Activity feed per group" \
"Chronological feed combining expenses and settlements for a group." \
"BRD core feature — transparency into group history." \
"- [ ] Feed shows expenses and settlements in one chronological list
- [ ] Feed updates in real time as new items are added
- [ ] Empty state shown for a brand-new group" \
"expenses, settlements"

create_feature "Activity feed entry detail" \
"Each feed entry shows who did what and when." \
"Makes the feed actually useful for resolving disputes/confusion." \
"- [ ] Entry shows actor, action type, amount (if applicable), timestamp
- [ ] Tapping an entry opens the relevant expense/settlement detail" \
"expenses, settlements, users"

# --- App Shell ---

create_feature "Primary navigation shell" \
"Bottom nav (or equivalent) providing access to Groups/Trips list, Balances, and Profile." \
"Needed for a working iOS app even though not explicitly called out as a BRD feature." \
"- [ ] Nav present on all primary screens
- [ ] Groups/Trips, Balances, Profile all reachable
- [ ] Current tab is visually indicated" \
"n/a (UI only)"

create_feature "Empty states" \
"Friendly empty states for no groups yet, no expenses yet, no activity yet." \
"First-run experience shouldn't look broken." \
"- [ ] No-groups empty state with a clear \"create your first group\" CTA
- [ ] No-expenses empty state within a group
- [ ] No-activity empty state on the feed" \
"n/a (UI only)"

echo "Done. Check $REPO for created issues."
