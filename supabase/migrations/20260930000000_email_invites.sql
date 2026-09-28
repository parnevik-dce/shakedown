-- Invite a group member by email (e.g. picked from the inviter's phone contacts),
-- instead of only via a shareable code. If the email already has an account, they
-- join immediately; otherwise the invite sits pending and is claimed automatically
-- the first time someone signs in with that email (see handle_new_user below).

create table public.group_email_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  email text not null,
  invited_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  consumed_at timestamptz -- set once the invited person has joined
);

-- At most one *active* (unconsumed) pending invite per group+email; inviting the
-- same person twice before they've joined is a no-op, not a duplicate row.
create unique index group_email_invites_pending_unique
  on public.group_email_invites (group_id, lower(email))
  where consumed_at is null;
create index group_email_invites_email_idx on public.group_email_invites (lower(email)) where consumed_at is null;

alter table public.group_email_invites enable row level security;

-- Members can see (and thus display) the pending invites for their own group.
create policy group_email_invites_select on public.group_email_invites for select to authenticated
  using (public.is_group_member(group_id));

revoke all on public.group_email_invites from anon;

-- ---------------------------------------------------------------------------
-- invite_member_by_email: the only way to create one of these (no direct
-- INSERT policy). Adds the person immediately if their account already
-- exists; otherwise leaves a pending invite for handle_new_user to claim.
-- ---------------------------------------------------------------------------
create function public.invite_member_by_email(p_group_id uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  existing_user uuid;
begin
  if not public.is_group_member(p_group_id) then raise exception 'Not a member of this group'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.'; end if;

  select id into existing_user from public.profiles where lower(email) = v_email limit 1;

  if existing_user is not null then
    -- Already has an account: add them (or bring them back if they'd left), same as
    -- redeeming an invite code. Already-a-member is a silent no-op, not an error.
    insert into public.group_members (group_id, user_id)
    values (p_group_id, existing_user)
    on conflict (group_id, user_id) do update set left_at = null, joined_at = now()
      where public.group_members.left_at is not null;
  else
    -- No account yet: leave a pending invite. Re-inviting the same pending email is
    -- a silent no-op thanks to the partial unique index below.
    insert into public.group_email_invites (group_id, email)
    values (p_group_id, v_email)
    on conflict (group_id, lower(email)) where consumed_at is null do nothing;
  end if;
end $$;

revoke execute on function public.invite_member_by_email(uuid, text) from public, anon;
grant execute on function public.invite_member_by_email(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Extend first-sign-in: also claim any pending invites for this email.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1),
      'Member'
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.group_members (group_id, user_id)
  select gei.group_id, new.id
  from public.group_email_invites gei
  where gei.consumed_at is null and lower(gei.email) = lower(new.email)
  on conflict (group_id, user_id) do update set left_at = null, joined_at = now()
    where public.group_members.left_at is not null;

  update public.group_email_invites
  set consumed_at = now()
  where consumed_at is null and lower(email) = lower(new.email);

  return new;
end $$;
