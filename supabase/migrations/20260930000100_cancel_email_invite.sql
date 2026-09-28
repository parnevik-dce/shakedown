-- Let a group member cancel a pending (unconsumed) email invite -- e.g. invited the
-- wrong person, or they simply don't want to wait on it anymore.
create function public.cancel_pending_invite(p_group_id uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_group_member(p_group_id) then raise exception 'Not a member of this group'; end if;
  delete from public.group_email_invites
   where group_id = p_group_id and lower(email) = lower(btrim(p_email)) and consumed_at is null;
end $$;

revoke execute on function public.cancel_pending_invite(uuid, text) from public, anon;
grant execute on function public.cancel_pending_invite(uuid, text) to authenticated;
