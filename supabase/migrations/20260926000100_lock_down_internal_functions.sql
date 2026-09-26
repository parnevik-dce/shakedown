-- Internal functions must not be callable through the API by anyone.
-- (Supabase's default privileges grant EXECUTE to anon/authenticated directly,
-- so revoking from PUBLIC alone was not enough.)
--
-- assert_no_open_balance leaked whether any person owes money in any group; it
-- is only called from leave_group / remove_group_member (security definer).
revoke execute on function
  public.assert_no_open_balance(uuid, uuid),
  public.add_group_creator_as_owner(),
  public.assert_expense_splits_total(),
  public.handle_new_user()
  from public, anon, authenticated;
