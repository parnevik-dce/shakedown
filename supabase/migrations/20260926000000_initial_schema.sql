-- Shakedown initial schema. See docs/DATA_MODEL.md.
-- Money is integer cents (USD). Balances are derived by views, never stored.
-- Writes to expenses / settlements / membership go through the RPC functions
-- below (no direct INSERT/UPDATE/DELETE policies), so rules can't be bypassed.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.group_kind as enum ('group', 'trip');
create type public.member_role as enum ('owner', 'member');
create type public.split_method as enum ('equal', 'exact', 'percent');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  email text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  kind public.group_kind not null default 'group',
  created_by uuid not null references public.profiles (id) default auth.uid(),
  -- Trip-only metadata (a trip is a group with extra fields)
  start_date date,
  end_date date,
  cover_image_path text,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_fields_only_for_trips check (
    kind = 'trip'
    or (start_date is null and end_date is null and cover_image_path is null and icon is null)
  ),
  constraint trip_dates_ordered check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  left_at timestamptz, -- soft leave: past expenses keep their people
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id) where left_at is null;

create table public.group_invites (
  code text primary key default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz
);
create index group_invites_group_idx on public.group_invites (group_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  amount_cents bigint not null check (amount_cents > 0),
  paid_by uuid not null references public.profiles (id),
  expense_date date not null default current_date,
  split_method public.split_method not null,
  receipt_path text,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index expenses_group_idx on public.expenses (group_id, expense_date desc) where deleted_at is null;

create table public.expense_splits (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  owed_cents bigint not null check (owed_cents >= 0),
  percent numeric(6, 3) check (percent is null or (percent >= 0 and percent <= 100)),
  primary key (expense_id, user_id)
);
create index expense_splits_user_idx on public.expense_splits (user_id);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  paid_by uuid not null references public.profiles (id),
  paid_to uuid not null references public.profiles (id),
  amount_cents bigint not null check (amount_cents > 0),
  settled_on date not null default current_date,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint settlement_distinct_people check (paid_by <> paid_to)
);
create index settlements_group_idx on public.settlements (group_id, settled_on desc) where deleted_at is null;

create table public.activity_log (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  actor_id uuid not null references public.profiles (id),
  action text not null check (action in (
    'expense_added', 'expense_edited', 'expense_deleted',
    'settlement_added', 'settlement_deleted'
  )),
  entity_type text not null check (entity_type in ('expense', 'settlement')),
  entity_id uuid not null,
  amount_cents bigint,
  summary text, -- snapshot of the description so deleted items still read well
  created_at timestamptz not null default now()
);
create index activity_log_group_idx on public.activity_log (group_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions (used by RLS and RPCs)
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger groups_set_updated_at before update on public.groups
  for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

create function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid()) and left_at is null
  );
$$;

-- True if the current user is in an active group with `uid` (incl. people who later left).
create function public.shares_group_with(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members other on other.group_id = me.group_id
    where me.user_id = (select auth.uid()) and me.left_at is null
      and other.user_id = uid
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles: auto-created on first sign-in (issue #2). Idempotent.
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
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

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed in before this migration existed.
insert into public.profiles (id, display_name, avatar_url, email)
select
  u.id,
  coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
           split_part(u.email, '@', 1), 'Member'),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture'),
  u.email
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Groups: creator becomes owner automatically; kind/created_by are immutable
-- ---------------------------------------------------------------------------
create function public.add_group_creator_as_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end $$;

create trigger groups_add_owner after insert on public.groups
  for each row execute function public.add_group_creator_as_owner();

create function public.protect_group_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind is distinct from old.kind or new.created_by is distinct from old.created_by then
    raise exception 'A group''s kind and creator cannot be changed';
  end if;
  return new;
end $$;

create trigger groups_protect_identity before update on public.groups
  for each row execute function public.protect_group_identity();

-- ---------------------------------------------------------------------------
-- Split integrity: splits must sum to the expense amount (deferred to commit
-- so an expense and its splits can be written together)
-- ---------------------------------------------------------------------------
create function public.assert_expense_splits_total() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  eid uuid;
  total bigint;
  expected bigint;
begin
  if tg_table_name = 'expenses' then
    eid := new.id;
  else
    eid := new.expense_id;
  end if;
  select amount_cents into expected from public.expenses where id = eid;
  select coalesce(sum(owed_cents), 0) into total from public.expense_splits where expense_id = eid;
  if expected is not null and total <> expected then
    raise exception 'Splits (% cents) must equal the expense amount (% cents)', total, expected;
  end if;
  return null;
end $$;

create constraint trigger expenses_splits_total after insert or update on public.expenses
  deferrable initially deferred for each row execute function public.assert_expense_splits_total();
create constraint trigger splits_total after insert or update on public.expense_splits
  deferrable initially deferred for each row execute function public.assert_expense_splits_total();

-- ---------------------------------------------------------------------------
-- Derived balances (positive net = the group owes that person)
-- security_invoker => the caller's RLS applies to these views
-- ---------------------------------------------------------------------------
create view public.group_net_balances with (security_invoker = true) as
select group_id, user_id, sum(cents)::bigint as net_cents
from (
  select e.group_id, e.paid_by as user_id, e.amount_cents as cents
    from public.expenses e where e.deleted_at is null
  union all
  select e.group_id, s.user_id, -s.owed_cents
    from public.expense_splits s join public.expenses e on e.id = s.expense_id
    where e.deleted_at is null
  union all
  select group_id, paid_by, amount_cents from public.settlements where deleted_at is null
  union all
  select group_id, paid_to, -amount_cents from public.settlements where deleted_at is null
) t
group by group_id, user_id;

-- Who owes whom within each group, netted per pair.
create view public.pairwise_balances with (security_invoker = true) as
with edges as (
  select e.group_id, s.user_id as debtor, e.paid_by as creditor, s.owed_cents as cents
    from public.expense_splits s join public.expenses e on e.id = s.expense_id
    where e.deleted_at is null and s.user_id <> e.paid_by
  union all
  select group_id, paid_by, paid_to, -amount_cents
    from public.settlements where deleted_at is null
),
pairs as (
  select group_id,
         least(debtor, creditor) as a,
         greatest(debtor, creditor) as b,
         sum(case when debtor < creditor then cents else -cents end) as a_owes_b
  from edges
  group by group_id, least(debtor, creditor), greatest(debtor, creditor)
)
select group_id,
       case when a_owes_b > 0 then a else b end as debtor,
       case when a_owes_b > 0 then b else a end as creditor,
       abs(a_owes_b)::bigint as cents
from pairs
where a_owes_b <> 0;

-- Same, netted across every group both people share (issues #19/#20).
create view public.overall_pairwise_balances with (security_invoker = true) as
with pairs as (
  select least(debtor, creditor) as a,
         greatest(debtor, creditor) as b,
         sum(case when debtor < creditor then cents else -cents end) as a_owes_b
  from public.pairwise_balances
  group by least(debtor, creditor), greatest(debtor, creditor)
)
select case when a_owes_b > 0 then a else b end as debtor,
       case when a_owes_b > 0 then b else a end as creditor,
       abs(a_owes_b)::bigint as cents
from pairs
where a_owes_b <> 0;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.activity_log enable row level security;

-- profiles: yourself, or people you share a group with; only you can edit yours
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- groups: members read/update (any member may edit trip details); anyone may create
create policy groups_select on public.groups for select to authenticated
  using (public.is_group_member(id) or created_by = (select auth.uid()));
create policy groups_insert on public.groups for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy groups_update on public.groups for update to authenticated
  using (public.is_group_member(id)) with check (public.is_group_member(id));

-- members: readable by members; changed only via RPCs
create policy group_members_select on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

-- invites: members create, read and revoke
create policy invites_select on public.group_invites for select to authenticated
  using (public.is_group_member(group_id));
create policy invites_insert on public.group_invites for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = (select auth.uid()));
create policy invites_update on public.group_invites for update to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

-- expenses / splits / settlements / activity: members read; writes only via RPCs
create policy expenses_select on public.expenses for select to authenticated
  using (public.is_group_member(group_id));
create policy expense_splits_select on public.expense_splits for select to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id)
  ));
create policy settlements_select on public.settlements for select to authenticated
  using (public.is_group_member(group_id));
create policy activity_log_select on public.activity_log for select to authenticated
  using (public.is_group_member(group_id));

-- Nothing is available to signed-out users.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- RPCs (security definer, explicit checks). Auth is re-verified in each.
-- ---------------------------------------------------------------------------
create function public.join_group_with_code(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  inv public.group_invites;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into inv from public.group_invites
   where code = upper(btrim(p_code)) and revoked_at is null and expires_at > now();
  if not found then raise exception 'Invite is invalid or expired'; end if;

  insert into public.group_members (group_id, user_id)
  values (inv.group_id, uid)
  on conflict (group_id, user_id) do update set left_at = null, joined_at = now()
    where public.group_members.left_at is not null;
  return inv.group_id;
end $$;

-- People are blocked from leaving/being removed while any debt involves them.
create function public.assert_no_open_balance(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.pairwise_balances
    where group_id = p_group and (debtor = p_user or creditor = p_user)
  ) then
    raise exception 'Settle up first: this person still has a nonzero balance in the group';
  end if;
end $$;

create function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if not public.is_group_member(p_group) then raise exception 'Not a member of this group'; end if;
  perform public.assert_no_open_balance(p_group, uid);
  update public.group_members set left_at = now()
   where group_id = p_group and user_id = uid;
end $$;

create function public.remove_group_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_group_member(p_group) then raise exception 'Not a member of this group'; end if;
  perform public.assert_no_open_balance(p_group, p_user);
  update public.group_members set left_at = now()
   where group_id = p_group and user_id = p_user and left_at is null;
end $$;

-- Create or edit an expense atomically. Only the creator may edit.
-- p_splits: [{"user_id": "...", "owed_cents": 334, "percent": 33.333}, ...]
-- Pass a client-generated p_expense_id for new expenses so a receipt can be
-- uploaded at receipts/{group_id}/{expense_id}.{ext} right after.
create function public.save_expense(
  p_group_id uuid,
  p_description text,
  p_amount_cents bigint,
  p_paid_by uuid,
  p_expense_date date,
  p_split_method public.split_method,
  p_splits jsonb,
  p_receipt_path text default null,
  p_expense_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  eid uuid := coalesce(p_expense_id, gen_random_uuid());
  existing public.expenses;
  is_new boolean;
  split_user uuid;
  pct_total numeric;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not public.is_group_member(p_group_id) then raise exception 'Not a member of this group'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if p_splits is null or jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'At least one person must be included in the split';
  end if;

  select * into existing from public.expenses where id = eid;
  is_new := not found;
  if not is_new then
    if existing.group_id <> p_group_id then raise exception 'Expense belongs to another group'; end if;
    if existing.deleted_at is not null then raise exception 'Expense was deleted'; end if;
    if existing.created_by <> uid then raise exception 'Only the person who created an expense can edit it'; end if;
  end if;

  -- Payer and everyone in the split must be active members (or already part of this expense).
  for split_user in
    select p_paid_by union select (s ->> 'user_id')::uuid from jsonb_array_elements(p_splits) s
  loop
    if not (
      exists (select 1 from public.group_members
              where group_id = p_group_id and user_id = split_user and left_at is null)
      or (not is_new and (existing.paid_by = split_user
          or exists (select 1 from public.expense_splits
                     where expense_id = eid and user_id = split_user)))
    ) then
      raise exception 'Everyone in an expense must be an active member of the group';
    end if;
  end loop;

  if p_split_method = 'percent' then
    select coalesce(sum((s ->> 'percent')::numeric), 0) into pct_total from jsonb_array_elements(p_splits) s;
    if pct_total <> 100 then raise exception 'Percentages must add up to 100'; end if;
  end if;

  if is_new then
    insert into public.expenses (id, group_id, description, amount_cents, paid_by, expense_date,
                                 split_method, receipt_path, created_by)
    values (eid, p_group_id, btrim(p_description), p_amount_cents, p_paid_by,
            coalesce(p_expense_date, current_date), p_split_method, p_receipt_path, uid);
  else
    update public.expenses
       set description = btrim(p_description), amount_cents = p_amount_cents, paid_by = p_paid_by,
           expense_date = coalesce(p_expense_date, expense_date), split_method = p_split_method,
           receipt_path = p_receipt_path
     where id = eid;
    delete from public.expense_splits where expense_id = eid;
  end if;

  insert into public.expense_splits (expense_id, user_id, owed_cents, percent)
  select eid, (s ->> 'user_id')::uuid, (s ->> 'owed_cents')::bigint, (s ->> 'percent')::numeric
  from jsonb_array_elements(p_splits) s;

  insert into public.activity_log (group_id, actor_id, action, entity_type, entity_id, amount_cents, summary)
  values (p_group_id, uid, case when is_new then 'expense_added' else 'expense_edited' end,
          'expense', eid, p_amount_cents, btrim(p_description));

  return eid;
end $$;

create function public.delete_expense(p_expense_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e public.expenses;
begin
  select * into e from public.expenses where id = p_expense_id and deleted_at is null;
  if not found or not public.is_group_member(e.group_id) then raise exception 'Expense not found'; end if;
  if e.created_by <> uid then raise exception 'Only the person who created an expense can delete it'; end if;
  update public.expenses set deleted_at = now() where id = p_expense_id;
  insert into public.activity_log (group_id, actor_id, action, entity_type, entity_id, amount_cents, summary)
  values (e.group_id, uid, 'expense_deleted', 'expense', p_expense_id, e.amount_cents, e.description);
end $$;

create function public.record_settlement(
  p_group_id uuid,
  p_paid_by uuid,
  p_paid_to uuid,
  p_amount_cents bigint,
  p_settled_on date default current_date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  sid uuid;
begin
  if not public.is_group_member(p_group_id) then raise exception 'Not a member of this group'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if p_paid_by = p_paid_to then raise exception 'Payer and recipient must be different people'; end if;
  if not (
    exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_paid_by and left_at is null)
    and exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_paid_to and left_at is null)
  ) then raise exception 'Both people must be active members of the group'; end if;

  insert into public.settlements (group_id, paid_by, paid_to, amount_cents, settled_on, created_by)
  values (p_group_id, p_paid_by, p_paid_to, p_amount_cents, coalesce(p_settled_on, current_date), uid)
  returning id into sid;

  insert into public.activity_log (group_id, actor_id, action, entity_type, entity_id, amount_cents)
  values (p_group_id, uid, 'settlement_added', 'settlement', sid, p_amount_cents);
  return sid;
end $$;

create function public.delete_settlement(p_settlement_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  s public.settlements;
begin
  select * into s from public.settlements where id = p_settlement_id and deleted_at is null;
  if not found or not public.is_group_member(s.group_id) then raise exception 'Settlement not found'; end if;
  if s.created_by <> uid then raise exception 'Only the person who recorded a settlement can delete it'; end if;
  update public.settlements set deleted_at = now() where id = p_settlement_id;
  insert into public.activity_log (group_id, actor_id, action, entity_type, entity_id, amount_cents)
  values (s.group_id, uid, 'settlement_deleted', 'settlement', p_settlement_id, s.amount_cents);
end $$;

-- Only signed-in users may call the RPCs / helpers.
revoke execute on function
  public.join_group_with_code(text), public.assert_no_open_balance(uuid, uuid),
  public.leave_group(uuid), public.remove_group_member(uuid, uuid),
  public.save_expense(uuid, text, bigint, uuid, date, public.split_method, jsonb, text, uuid),
  public.delete_expense(uuid), public.record_settlement(uuid, uuid, uuid, bigint, date),
  public.delete_settlement(uuid), public.is_group_member(uuid), public.shares_group_with(uuid)
  from public, anon;
grant execute on function
  public.join_group_with_code(text), public.leave_group(uuid), public.remove_group_member(uuid, uuid),
  public.save_expense(uuid, text, bigint, uuid, date, public.split_method, jsonb, text, uuid),
  public.delete_expense(uuid), public.record_settlement(uuid, uuid, uuid, bigint, date),
  public.delete_settlement(uuid), public.is_group_member(uuid), public.shares_group_with(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private buckets, access limited to group members
-- Paths: receipts/{group_id}/{expense_id}.{ext}, trip-covers/{group_id}/{file}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('trip-covers', 'trip-covers', false, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

-- First path segment as a uuid, or null if it isn't one.
create function public.storage_group_id(object_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case when split_part(object_name, '/', 1)
              ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         then split_part(object_name, '/', 1)::uuid end;
$$;

-- Receipt writes: only the expense's creator (file name = expense id).
create function public.can_write_receipt(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  file_stem text := split_part(split_part(object_name, '/', 2), '.', 1);
begin
  if file_stem !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1 from public.expenses e
    where e.id = file_stem::uuid
      and e.group_id = public.storage_group_id(object_name)
      and e.created_by = (select auth.uid())
      and e.deleted_at is null
  ) and public.is_group_member(public.storage_group_id(object_name));
end $$;

revoke execute on function public.storage_group_id(text), public.can_write_receipt(text) from public, anon;
grant execute on function public.storage_group_id(text), public.can_write_receipt(text) to authenticated;

create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_group_member(public.storage_group_id(name)));
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.can_write_receipt(name));
create policy receipts_update on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and public.can_write_receipt(name))
  with check (bucket_id = 'receipts' and public.can_write_receipt(name));
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.can_write_receipt(name));

create policy covers_read on storage.objects for select to authenticated
  using (bucket_id = 'trip-covers' and public.is_group_member(public.storage_group_id(name)));
create policy covers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-covers' and public.is_group_member(public.storage_group_id(name)));
create policy covers_update on storage.objects for update to authenticated
  using (bucket_id = 'trip-covers' and public.is_group_member(public.storage_group_id(name)))
  with check (bucket_id = 'trip-covers' and public.is_group_member(public.storage_group_id(name)));
create policy covers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'trip-covers' and public.is_group_member(public.storage_group_id(name)));

-- ---------------------------------------------------------------------------
-- Realtime (live feed and instant balances). RLS still applies to subscribers.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.expenses, public.expense_splits, public.settlements, public.activity_log;
