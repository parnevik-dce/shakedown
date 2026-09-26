// Debt simplification: given each person's net balance, find the FEWEST payments
// that leave everyone at zero. Work in integer cents.
//
// Idea: a set of people whose balances sum to zero can settle among themselves in
// (size - 1) payments. So the minimum number of payments is
//   (people with a nonzero balance) - (max number of disjoint zero-sum groups).
// We find that maximum exactly with a subset DP (fine up to ~20 people), then turn
// each group into payments. Beyond that size we fall back to a greedy matching,
// which is still correct (everyone ends at zero) but may use a few extra payments.

export type Balance = { userId: string; cents: number }; // + = is owed, - = owes
export type Payment = { from: string; to: string; cents: number }; // `from` pays `to`

/** Largest group we solve exactly. 2^20 states is ~20M cheap steps. */
export const EXACT_LIMIT = 20;

export function simplifyDebts(balances: Balance[]): Payment[] {
  const people = balances.filter((b) => b.cents !== 0);
  const total = people.reduce((s, b) => s + b.cents, 0);
  if (total !== 0) throw new Error(`Balances must sum to zero (off by ${total} cents)`);
  if (people.length === 0) return [];

  const groups = people.length <= EXACT_LIMIT ? zeroSumGroups(people) : [people];
  return groups.flatMap(settleGroup);
}

/** Split people into the maximum number of disjoint groups that each sum to zero. */
function zeroSumGroups(people: Balance[]): Balance[][] {
  const m = people.length;
  const size = 1 << m;
  const sum = new Float64Array(size);
  const best = new Int8Array(size); // most zero-sum cuts achievable ordering this subset
  const last = new Int8Array(size); // which member to place last to achieve `best`

  for (let mask = 1; mask < size; mask++) {
    const low = 31 - Math.clz32(mask & -mask);
    sum[mask] = sum[mask & (mask - 1)] + people[low].cents;
    let top = -1;
    let pick = 0;
    for (let i = 0; i < m; i++) {
      if (!(mask & (1 << i))) continue;
      const v = best[mask ^ (1 << i)];
      if (v > top) {
        top = v;
        pick = i;
      }
    }
    best[mask] = top + (sum[mask] === 0 ? 1 : 0);
    last[mask] = pick;
  }

  // Recover the ordering, then cut wherever the running total hits zero.
  const order: number[] = [];
  for (let mask = size - 1; mask > 0; mask ^= 1 << last[mask]) order.push(last[mask]);
  order.reverse();

  const groups: Balance[][] = [];
  let current: Balance[] = [];
  let running = 0;
  for (const i of order) {
    current.push(people[i]);
    running += people[i].cents;
    if (running === 0) {
      groups.push(current);
      current = [];
    }
  }
  return groups;
}

/** Greedy matching inside one zero-sum group: each payment clears at least one person. */
function settleGroup(group: Balance[]): Payment[] {
  const owed = group.filter((b) => b.cents > 0).map((b) => ({ ...b })).sort((a, b) => b.cents - a.cents);
  const owing = group.filter((b) => b.cents < 0).map((b) => ({ userId: b.userId, cents: -b.cents })).sort((a, b) => b.cents - a.cents);
  const payments: Payment[] = [];
  let i = 0;
  let j = 0;
  while (i < owed.length && j < owing.length) {
    const cents = Math.min(owed[i].cents, owing[j].cents);
    payments.push({ from: owing[j].userId, to: owed[i].userId, cents });
    owed[i].cents -= cents;
    owing[j].cents -= cents;
    if (owed[i].cents === 0) i++;
    if (owing[j].cents === 0) j++;
  }
  return payments;
}
