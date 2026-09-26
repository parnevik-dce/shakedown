import { simplifyDebts, type Payment } from './simplify';
import { supabase } from './supabase';

function unwrap<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

/** `debtor` owes `creditor`. */
export type Debt = { debtorId: string; creditorId: string; cents: number; expenseCount: number };

export type GroupBalances = {
  /** Exactly who owes whom, netted per pair. */
  raw: Debt[];
  /** Fewest payments that clear everyone. */
  simplified: Payment[];
  /** Each member's net in the group, in cents. Positive = owed money. */
  net: Map<string, number>;
};

export async function fetchGroupBalances(groupId: string): Promise<GroupBalances> {
  const [pairs, nets, expenses] = await Promise.all([
    supabase.from('pairwise_balances').select('debtor, creditor, cents').eq('group_id', groupId),
    supabase.from('group_net_balances').select('user_id, net_cents').eq('group_id', groupId),
    supabase
      .from('expenses')
      .select('paid_by, expense_splits(user_id, owed_cents)')
      .eq('group_id', groupId)
      .is('deleted_at', null),
  ]);

  // How many expenses link each pair, for the "from 2 expenses" caption.
  const counts = new Map<string, number>();
  for (const e of unwrap(expenses)) {
    for (const s of e.expense_splits) {
      if (s.user_id !== e.paid_by && Number(s.owed_cents) > 0) {
        const key = `${s.user_id}>${e.paid_by}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  const net = new Map<string, number>();
  for (const r of unwrap(nets)) if (r.user_id) net.set(r.user_id, Number(r.net_cents ?? 0));

  const raw = unwrap(pairs)
    .filter((r) => r.debtor && r.creditor)
    .map((r) => ({
      debtorId: r.debtor as string,
      creditorId: r.creditor as string,
      cents: Number(r.cents),
      expenseCount: (counts.get(`${r.debtor}>${r.creditor}`) ?? 0) + (counts.get(`${r.creditor}>${r.debtor}`) ?? 0),
    }))
    .sort((a, b) => b.cents - a.cents);

  return {
    raw,
    net,
    simplified: simplifyDebts([...net.entries()].map(([userId, cents]) => ({ userId, cents }))),
  };
}

export type PersonBalance = {
  userId: string;
  displayName: string;
  /** Positive = they owe me, negative = I owe them. Netted across all shared groups. */
  cents: number;
  /** Where it comes from, signed the same way. */
  groups: { groupId: string; groupName: string; cents: number }[];
};

export type OverallBalances = {
  totalCents: number;
  groupCount: number;
  owesMe: PersonBalance[];
  iOwe: PersonBalance[];
};

export async function fetchOverallBalances(myId: string): Promise<OverallBalances> {
  const [overall, perGroup] = await Promise.all([
    supabase.from('overall_pairwise_balances').select('debtor, creditor, cents'),
    supabase.from('pairwise_balances').select('group_id, debtor, creditor, cents'),
  ]);

  const mine = unwrap(overall).filter((r) => r.debtor === myId || r.creditor === myId);
  const perGroupMine = unwrap(perGroup).filter((r) => r.debtor === myId || r.creditor === myId);

  const otherIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const r of mine) otherIds.add((r.debtor === myId ? r.creditor : r.debtor) as string);
  for (const r of perGroupMine) groupIds.add(r.group_id as string);

  const [profiles, groups] = await Promise.all([
    otherIds.size
      ? supabase.from('profiles').select('id, display_name').in('id', [...otherIds])
      : Promise.resolve({ data: [], error: null }),
    groupIds.size
      ? supabase.from('groups').select('id, name').in('id', [...groupIds])
      : Promise.resolve({ data: [], error: null }),
  ]);
  const names = new Map(unwrap(profiles).map((p) => [p.id, p.display_name]));
  const groupNames = new Map(unwrap(groups).map((g) => [g.id, g.name]));

  const people = new Map<string, PersonBalance>();
  for (const r of mine) {
    const other = (r.debtor === myId ? r.creditor : r.debtor) as string;
    const cents = r.creditor === myId ? Number(r.cents) : -Number(r.cents);
    people.set(other, { userId: other, displayName: names.get(other) ?? 'Someone', cents, groups: [] });
  }
  for (const r of perGroupMine) {
    const other = (r.debtor === myId ? r.creditor : r.debtor) as string;
    const person = people.get(other);
    // A pair can net to zero overall while still being nonzero in individual groups; skip those.
    if (!person) continue;
    person.groups.push({
      groupId: r.group_id as string,
      groupName: groupNames.get(r.group_id as string) ?? 'Group',
      cents: r.creditor === myId ? Number(r.cents) : -Number(r.cents),
    });
  }

  const all = [...people.values()].sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
  return {
    totalCents: all.reduce((s, p) => s + p.cents, 0),
    groupCount: groupIds.size,
    owesMe: all.filter((p) => p.cents > 0),
    iOwe: all.filter((p) => p.cents < 0),
  };
}
