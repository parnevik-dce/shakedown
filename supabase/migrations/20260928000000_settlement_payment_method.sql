-- Payment method on a settlement (how the money actually moved, outside the app).
-- Nullable so existing settlements need no backfill; the app requires a choice for new ones.

create type public.payment_method as enum ('venmo', 'cash', 'paypal', 'zelle', 'bank_transfer', 'cash_app', 'other');

alter table public.settlements
  add column payment_method public.payment_method,
  add column payment_method_note text,
  add constraint settlement_other_method_has_note
    check (payment_method_note is null or (payment_method = 'other' and char_length(btrim(payment_method_note)) between 1 and 40)),
  add constraint settlement_other_method_requires_note
    check (payment_method is distinct from 'other' or payment_method_note is not null);

-- Replace record_settlement to accept the two new (optional) params.
drop function public.record_settlement(uuid, uuid, uuid, bigint, date);

create function public.record_settlement(
  p_group_id uuid,
  p_paid_by uuid,
  p_paid_to uuid,
  p_amount_cents bigint,
  p_settled_on date default current_date,
  p_payment_method public.payment_method default null,
  p_payment_method_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  sid uuid;
  note text := nullif(btrim(coalesce(p_payment_method_note, '')), '');
begin
  if not public.is_group_member(p_group_id) then raise exception 'Not a member of this group'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if p_paid_by = p_paid_to then raise exception 'Payer and recipient must be different people'; end if;
  if not (
    exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_paid_by and left_at is null)
    and exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_paid_to and left_at is null)
  ) then raise exception 'Both people must be active members of the group'; end if;
  if p_payment_method is distinct from 'other' then note := null; end if;
  if p_payment_method = 'other' and note is null then raise exception 'Enter a payment method.'; end if;

  insert into public.settlements (group_id, paid_by, paid_to, amount_cents, settled_on, created_by, payment_method, payment_method_note)
  values (p_group_id, p_paid_by, p_paid_to, p_amount_cents, coalesce(p_settled_on, current_date), uid, p_payment_method, note)
  returning id into sid;

  insert into public.activity_log (group_id, actor_id, action, entity_type, entity_id, amount_cents)
  values (p_group_id, uid, 'settlement_added', 'settlement', sid, p_amount_cents);
  return sid;
end $$;

revoke execute on function
  public.record_settlement(uuid, uuid, uuid, bigint, date, public.payment_method, text)
  from public, anon;
grant execute on function
  public.record_settlement(uuid, uuid, uuid, bigint, date, public.payment_method, text)
  to authenticated;
