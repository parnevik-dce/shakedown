import type { Database } from './database.types';
import { toDateString } from './expenses';
import { supabase } from './supabase';

function unwrap<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

export type PaymentMethod = Database['public']['Enums']['payment_method'];

export const PAYMENT_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'venmo', label: 'Venmo' },
  { key: 'cash', label: 'Cash' },
  { key: 'paypal', label: 'PayPal' },
  { key: 'zelle', label: 'Zelle' },
  { key: 'bank_transfer', label: 'Bank transfer' },
  { key: 'cash_app', label: 'Cash App' },
  { key: 'other', label: 'Other' },
];

export function paymentMethodLabel(method: PaymentMethod | null, note: string | null): string | null {
  if (!method) return null;
  if (method === 'other') return note ?? 'Other';
  return PAYMENT_METHODS.find((m) => m.key === method)?.label ?? method;
}

export type Settlement = {
  id: string;
  groupId: string;
  groupName: string;
  paidBy: string;
  payerName: string;
  paidTo: string;
  payeeName: string;
  amountCents: number;
  settledOn: string;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  deleted: boolean;
  paymentMethod: PaymentMethod | null;
  paymentMethodNote: string | null;
};

const SETTLEMENT_SELECT = `id, group_id, paid_by, paid_to, amount_cents, settled_on, created_by, created_at, deleted_at,
  payment_method, payment_method_note,
  grp:groups(name),
  payer:profiles!settlements_paid_by_fkey(display_name),
  payee:profiles!settlements_paid_to_fkey(display_name),
  creator:profiles!settlements_created_by_fkey(display_name)`;

type Row = {
  id: string;
  group_id: string;
  paid_by: string;
  paid_to: string;
  amount_cents: number;
  settled_on: string;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
  payment_method: PaymentMethod | null;
  payment_method_note: string | null;
  grp: { name: string } | null;
  payer: { display_name: string } | null;
  payee: { display_name: string } | null;
  creator: { display_name: string } | null;
};

function toSettlement(r: Row): Settlement {
  return {
    id: r.id,
    groupId: r.group_id,
    groupName: r.grp?.name ?? 'Group',
    paidBy: r.paid_by,
    payerName: r.payer?.display_name ?? 'Someone',
    paidTo: r.paid_to,
    payeeName: r.payee?.display_name ?? 'Someone',
    amountCents: Number(r.amount_cents),
    settledOn: r.settled_on,
    createdBy: r.created_by,
    creatorName: r.creator?.display_name ?? 'Someone',
    createdAt: r.created_at,
    deleted: r.deleted_at !== null,
    paymentMethod: r.payment_method,
    paymentMethodNote: r.payment_method_note,
  };
}

export async function fetchSettlement(id: string): Promise<Settlement> {
  const s = toSettlement(unwrap(await supabase.from('settlements').select(SETTLEMENT_SELECT).eq('id', id).single()) as Row);
  if (s.deleted) throw new Error('This payment was deleted.');
  return s;
}

/** Live (not deleted) settlements for a group, newest first. */
export async function fetchGroupSettlements(groupId: string): Promise<Settlement[]> {
  const rows = unwrap(
    await supabase
      .from('settlements')
      .select(SETTLEMENT_SELECT)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('settled_on', { ascending: false })
      .order('created_at', { ascending: false })
  ) as Row[];
  return rows.map(toSettlement);
}

export async function recordSettlement(input: {
  groupId: string;
  paidBy: string;
  paidTo: string;
  amountCents: number;
  settledOn: Date;
  paymentMethod: PaymentMethod;
  paymentMethodNote?: string | null;
}): Promise<string> {
  return unwrap(
    await supabase.rpc('record_settlement', {
      p_group_id: input.groupId,
      p_paid_by: input.paidBy,
      p_paid_to: input.paidTo,
      p_amount_cents: input.amountCents,
      p_settled_on: toDateString(input.settledOn),
      p_payment_method: input.paymentMethod,
      p_payment_method_note: input.paymentMethodNote ?? undefined,
    })
  );
}

export async function deleteSettlement(id: string): Promise<void> {
  unwrap(await supabase.rpc('delete_settlement', { p_settlement_id: id }));
}
