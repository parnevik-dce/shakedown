-- Email invites become real invitations: the invited person sees them when they
-- sign in and chooses to join or decline, instead of being added automatically.
-- A declined invite stays visible to the group as "Declined" and can be re-sent.

alter table public.group_email_invites
  add column status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  add column responded_at timestamptz;

update public.group_email_invites set status = 'accepted', responded_at = consumed_at where consumed_at is not null;

drop index public.group_email_invites_pending_unique;
drop index public.group_email_invites_email_idx;
alter table public.group_email_invites drop column consumed_at;
-- Kept as a computed column so app builds that predate invitation responses (which
-- filter on consumed_at) keep working; new code uses status.
alter table public.group_email_invites
  add column consumed_at timestamptz generated always as (case when status = 'accepted' then responded_at end) stored;

-- One open (pending or declined) invite per group+email; an accepted one is history,
-- so the person can be invited again later if they leave.
create unique index group_email_invites_open_unique
  on public.group_email_invites (group_id, lower(email)) where status <> 'accepted';
create index group_email_invites_email_idx
  on public.group_email_invites (lower(email)) where status = 'pending';

-- ---------------------------------------------------------------------------
-- invite_member_by_email: always creates (or re-sends) an invitation. Nobody is
-- added to the group until they accept it themselves.
-- ---------------------------------------------------------------------------
create or replace function public.invite_member_by_email(p_group_id uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
begin
  if not public.is_group_member(p_group_id) then raise exception 'Not a member of this group'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.'; end if;

  -- Already an active member: nothing to invite.
  if exists (
    select 1 from public.group_members gm join public.profiles p on p.id = gm.user_id
    where gm.group_id = p_group_id and gm.left_at is null and lower(p.email) = v_email
  ) then
    return;
  end if;

  -- New invite, or re-send to someone who declined (back to pending).
  insert into public.group_email_invites (group_id, email)
  values (p_group_id, v_email)
  on conflict (group_id, lower(email)) where status <> 'accepted'
  do update set status = 'pending', responded_at = null, invited_by = auth.uid(), created_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- The signed-in user's own pending invitations, with enough group info to show.
-- ---------------------------------------------------------------------------
create function public.my_group_invites() returns table (
  invite_id uuid, group_id uuid, group_name text, group_kind text, group_icon text,
  invited_by_name text, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select gei.id, g.id, g.name, g.kind::text, g.icon, inviter.display_name, gei.created_at
  from public.group_email_invites gei
  join public.profiles me on me.id = auth.uid() and lower(me.email) = lower(gei.email)
  join public.groups g on g.id = gei.group_id
  left join public.profiles inviter on inviter.id = gei.invited_by
  where gei.status = 'pending'
  order by gei.created_at desc
$$;

revoke execute on function public.my_group_invites() from public, anon;
grant execute on function public.my_group_invites() to authenticated;

-- ---------------------------------------------------------------------------
-- Accept (join the group) or decline an invitation addressed to your own email.
-- Returns the group id.
-- ---------------------------------------------------------------------------
create function public.respond_to_group_invite(p_invite_id uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.group_email_invites;
begin
  select gei.* into v_inv
  from public.group_email_invites gei
  join public.profiles me on me.id = auth.uid() and lower(me.email) = lower(gei.email)
  where gei.id = p_invite_id and gei.status = 'pending'
  for update of gei;
  if not found then raise exception 'Invitation not found'; end if;

  if p_accept then
    insert into public.group_members (group_id, user_id)
    values (v_inv.group_id, auth.uid())
    on conflict (group_id, user_id) do update set left_at = null, joined_at = now()
      where public.group_members.left_at is not null;
    update public.group_email_invites set status = 'accepted', responded_at = now() where id = v_inv.id;
  else
    update public.group_email_invites set status = 'declined', responded_at = now() where id = v_inv.id;
  end if;
  return v_inv.group_id;
end $$;

revoke execute on function public.respond_to_group_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_to_group_invite(uuid, boolean) to authenticated;

-- Group members can still cancel an open invite (pending or declined).
create or replace function public.cancel_pending_invite(p_group_id uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_group_member(p_group_id) then raise exception 'Not a member of this group'; end if;
  delete from public.group_email_invites
   where group_id = p_group_id and lower(email) = lower(btrim(p_email)) and status <> 'accepted';
end $$;

-- First sign-in no longer auto-joins invited groups: just create the profile.
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
  return new;
end $$;
