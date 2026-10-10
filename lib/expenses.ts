import * as Crypto from 'expo-crypto';

import type { Json } from './database.types';
import type { Split, SplitMethod } from './splits';
import { supabase } from './supabase';

function unwrap<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

/** 'YYYY-MM-DD' in the device's local time zone (what the DB `date` column stores). */
export function toDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export type ExpenseDetail = {
  id: string;
  groupId: string;
  description: string;
  amountCents: number;
  paidBy: string;
  payerName: string;
  expenseDate: string;
  splitMethod: SplitMethod;
  createdBy: string;
  creatorName: string;
  /** When the expense was entered (ISO timestamp), as opposed to the date it's dated. */
  createdAt: string;
  receiptPath: string | null;
  splits: { userId: string; displayName: string; email: string | null; owedCents: number; percent: number | null }[];
};

export async function fetchExpense(id: string): Promise<ExpenseDetail> {
  const e = unwrap(
    await supabase
      .from('expenses')
      .select(
        `id, group_id, description, amount_cents, paid_by, expense_date, split_method, created_by, created_at, receipt_path, deleted_at,
         payer:profiles!expenses_paid_by_fkey(display_name),
         creator:profiles!expenses_created_by_fkey(display_name),
         expense_splits(user_id, owed_cents, percent, profiles(display_name, email))`
      )
      .eq('id', id)
      .single()
  );
  if (e.deleted_at) throw new Error('This expense was deleted.');
  return {
    id: e.id,
    groupId: e.group_id,
    description: e.description,
    amountCents: Number(e.amount_cents),
    paidBy: e.paid_by,
    payerName: e.payer?.display_name ?? 'Someone',
    expenseDate: e.expense_date,
    splitMethod: e.split_method,
    createdBy: e.created_by,
    creatorName: e.creator?.display_name ?? 'Someone',
    createdAt: e.created_at,
    receiptPath: e.receipt_path,
    splits: e.expense_splits
      .map((s) => ({
        userId: s.user_id,
        displayName: s.profiles?.display_name ?? 'Member',
        email: s.profiles?.email ?? null,
        owedCents: Number(s.owed_cents),
        percent: s.percent === null ? null : Number(s.percent),
      }))
      .sort((a, b) => b.owedCents - a.owedCents || a.displayName.localeCompare(b.displayName)),
  };
}

export type SaveExpenseInput = {
  /** Omit to create; pass an existing id to edit (creator only, enforced by the DB). */
  id?: string;
  groupId: string;
  description: string;
  amountCents: number;
  paidBy: string;
  expenseDate: Date;
  method: SplitMethod;
  splits: Split[];
  receiptPath?: string | null;
};

/** Saves the expense and its splits in one transaction. Returns the expense id. */
export async function saveExpense(input: SaveExpenseInput): Promise<string> {
  const splits: Json = input.splits.map((s) => ({
    user_id: s.userId,
    owed_cents: s.owedCents,
    percent: s.percent,
  }));
  return unwrap(
    await supabase.rpc('save_expense', {
      p_group_id: input.groupId,
      p_description: input.description,
      p_amount_cents: input.amountCents,
      p_paid_by: input.paidBy,
      p_expense_date: toDateString(input.expenseDate),
      p_split_method: input.method,
      p_splits: splits,
      p_receipt_path: input.receiptPath ?? undefined,
      // Client-generated so a receipt can be uploaded to receipts/{group}/{expense}.jpg right after.
      p_expense_id: input.id ?? Crypto.randomUUID(),
    })
  );
}

export async function deleteExpense(id: string): Promise<void> {
  unwrap(await supabase.rpc('delete_expense', { p_expense_id: id }));
}

export type ExpenseListItem = {
  id: string;
  description: string;
  amountCents: number;
  paidBy: string;
  payerName: string;
  expenseDate: string;
  /** When the expense was entered (ISO timestamp), as opposed to the date it's dated. */
  createdAt: string;
  hasReceipt: boolean;
  /** Everyone with a share in the split (including people who have since left the group). */
  splitPeople: { userId: string; name: string }[];
  /** What this expense means for me: what I lent, or what I owe. */
  mine: { kind: 'lent' | 'owe' | 'none'; cents: number };
};

/** Just the live expenses for a group — no edits/deletions/settlements, unlike the activity feed. */
export async function fetchGroupExpenseList(groupId: string, myId: string): Promise<ExpenseListItem[]> {
  const rows = unwrap(
    await supabase
      .from('expenses')
      .select(
        'id, description, amount_cents, paid_by, expense_date, created_at, receipt_path, expense_splits(user_id, owed_cents, profile:profiles(display_name)), payer:profiles!expenses_paid_by_fkey(display_name)'
      )
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
  );

  return rows.map((e) => {
    const myShare = Number(e.expense_splits.find((s) => s.user_id === myId)?.owed_cents ?? 0);
    const mine: ExpenseListItem['mine'] =
      e.paid_by === myId
        ? { kind: 'lent', cents: Number(e.amount_cents) - myShare }
        : myShare > 0
          ? { kind: 'owe', cents: myShare }
          : { kind: 'none', cents: 0 };
    return {
      id: e.id,
      description: e.description,
      amountCents: Number(e.amount_cents),
      paidBy: e.paid_by,
      payerName: e.payer?.display_name ?? 'Someone',
      expenseDate: e.expense_date,
      createdAt: e.created_at,
      hasReceipt: e.receipt_path !== null,
      splitPeople: e.expense_splits.map((s) => ({ userId: s.user_id, name: s.profile?.display_name ?? 'Someone' })),
      mine,
    };
  });
}

export type ActivityItem = {
  id: number;
  action: 'expense_added' | 'expense_edited' | 'expense_deleted' | 'settlement_added' | 'settlement_deleted';
  actorId: string;
  actorName: string;
  entityType: 'expense' | 'settlement';
  entityId: string;
  amountCents: number | null;
  summary: string | null;
  createdAt: string;
  /** For expense entries whose expense still exists: what it means for me. */
  mine: { kind: 'lent' | 'owe' | 'none'; cents: number } | null;
  /** For settlement entries: who paid whom. */
  settlement: { paidBy: string; payerName: string; paidTo: string; payeeName: string; deleted: boolean } | null;
};

export type GroupActivity = {
  items: ActivityItem[];
  expenseCount: number;
  /** My net balance in this group, in cents. Positive = I'm owed. */
  myNetCents: number;
};

export async function fetchGroupActivity(groupId: string, myId: string): Promise<GroupActivity> {
  const [log, expenses, balance, settlements] = await Promise.all([
    supabase
      .from('activity_log')
      .select(
        'id, action, actor_id, entity_type, entity_id, amount_cents, summary, created_at, actor:profiles!activity_log_actor_id_fkey(display_name)'
      )
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(200),
    supabase
      .from('expenses')
      .select('id, amount_cents, paid_by, expense_splits(user_id, owed_cents)')
      .eq('group_id', groupId)
      .is('deleted_at', null),
    supabase.from('group_net_balances').select('net_cents').eq('group_id', groupId).eq('user_id', myId).maybeSingle(),
    supabase
      .from('settlements')
      .select(
        'id, paid_by, paid_to, deleted_at, payer:profiles!settlements_paid_by_fkey(display_name), payee:profiles!settlements_paid_to_fkey(display_name)'
      )
      .eq('group_id', groupId),
  ]);

  const settlementById = new Map(
    unwrap(settlements).map((s) => [
      s.id,
      {
        paidBy: s.paid_by,
        payerName: s.payer?.display_name ?? 'Someone',
        paidTo: s.paid_to,
        payeeName: s.payee?.display_name ?? 'Someone',
        deleted: s.deleted_at !== null,
      },
    ])
  );

  const mineByExpense = new Map<string, NonNullable<ActivityItem['mine']>>();
  const liveExpenses = unwrap(expenses);
  for (const e of liveExpenses) {
    const myShare = e.expense_splits.find((s) => s.user_id === myId)?.owed_cents ?? 0;
    if (e.paid_by === myId) {
      mineByExpense.set(e.id, { kind: 'lent', cents: Number(e.amount_cents) - Number(myShare) });
    } else if (Number(myShare) > 0) {
      mineByExpense.set(e.id, { kind: 'owe', cents: Number(myShare) });
    } else {
      mineByExpense.set(e.id, { kind: 'none', cents: 0 });
    }
  }

  return {
    expenseCount: liveExpenses.length,
    // No row at all until the group has an expense, so treat "none" as 0.
    myNetCents: Number((balance.error ? unwrap(balance) : balance.data)?.net_cents ?? 0),
    items: unwrap(log).map((r) => ({
      id: r.id,
      action: r.action as ActivityItem['action'],
      actorId: r.actor_id,
      actorName: r.actor?.display_name ?? 'Someone',
      entityType: r.entity_type as ActivityItem['entityType'],
      entityId: r.entity_id,
      amountCents: r.amount_cents === null ? null : Number(r.amount_cents),
      summary: r.summary,
      createdAt: r.created_at,
      mine: r.entity_type === 'expense' ? (mineByExpense.get(r.entity_id) ?? null) : null,
      settlement: r.entity_type === 'settlement' ? (settlementById.get(r.entity_id) ?? null) : null,
    })),
  };
}
