import assert from 'node:assert/strict';
import { test } from 'node:test';

import { simplifyDebts, type Balance } from './simplify.ts';

const bal = (...cents: number[]): Balance[] => cents.map((c, i) => ({ userId: `u${i}`, cents: c }));

function netAfter(balances: Balance[], payments: ReturnType<typeof simplifyDebts>) {
  const net = new Map(balances.map((b) => [b.userId, b.cents]));
  for (const p of payments) {
    net.set(p.from, (net.get(p.from) ?? 0) + p.cents); // payer's debt shrinks
    net.set(p.to, (net.get(p.to) ?? 0) - p.cents); // payee is owed less
  }
  return [...net.values()];
}

/** Independent oracle: min payments = people - max number of disjoint zero-sum groups. */
function bruteForceMin(cents: number[]): number {
  const nz = cents.filter((c) => c !== 0);
  const m = nz.length;
  const full = (1 << m) - 1;
  const sum = (mask: number) => nz.reduce((s, c, i) => s + (mask & (1 << i) ? c : 0), 0);
  const memo = new Map<number, number>();
  const groups = (mask: number): number => {
    if (mask === 0) return 0;
    if (memo.has(mask)) return memo.get(mask)!;
    let best = -Infinity;
    for (let sub = mask; sub > 0; sub = (sub - 1) & mask) {
      if (sum(sub) === 0) best = Math.max(best, 1 + groups(mask ^ sub));
    }
    memo.set(mask, best);
    return best;
  };
  return m === 0 ? 0 : m - groups(full);
}

test('the wireframe example: 4 raw debts become 2 payments', () => {
  // You +54.00 (owed), Maya -12.60-... use a simple 4 person case
  const b = bal(5400, -860, -900, -3640);
  const p = simplifyDebts(b);
  assert.ok(p.length <= 3);
  assert.deepEqual(netAfter(b, p).filter((n) => n !== 0), []);
});

test('empty and already settled', () => {
  assert.deepEqual(simplifyDebts([]), []);
  assert.deepEqual(simplifyDebts(bal(0, 0, 0)), []);
});

test('one debtor one creditor is a single payment', () => {
  assert.deepEqual(simplifyDebts(bal(1000, -1000)), [{ from: 'u1', to: 'u0', cents: 1000 }]);
});

test('independent pairs stay independent (greedy across all would use 3)', () => {
  // +10 -10 and +7 -3 -4: two zero-sum groups -> 1 + 2 = 3 payments, not 4
  const b = bal(1000, -1000, 700, -300, -400);
  const p = simplifyDebts(b);
  assert.equal(p.length, 3);
  assert.deepEqual(netAfter(b, p).filter((n) => n !== 0), []);
});

test('rejects balances that do not sum to zero', () => {
  assert.throws(() => simplifyDebts(bal(100, -50)), /sum to zero/);
});

test('matches the brute-force minimum on random groups', () => {
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let trial = 0; trial < 300; trial++) {
    const n = 2 + Math.floor(rand() * 7); // 2..8 people
    const cents = Array.from({ length: n - 1 }, () => Math.round((rand() - 0.5) * 20) * 100);
    cents.push(-cents.reduce((a, b) => a + b, 0));
    const b = bal(...cents);
    const p = simplifyDebts(b);
    assert.deepEqual(netAfter(b, p).filter((x) => x !== 0), [], `not cleared: ${cents}`);
    assert.equal(p.length, bruteForceMin(cents), `not minimal: ${cents}`);
    for (const pay of p) assert.ok(pay.cents > 0 && pay.from !== pay.to);
  }
});

test('20 people solves quickly and correctly', () => {
  const cents = Array.from({ length: 19 }, (_, i) => (i % 2 === 0 ? 1 : -1) * (100 + i * 37));
  cents.push(-cents.reduce((a, b) => a + b, 0));
  const b = bal(...cents);
  const start = performance.now();
  const p = simplifyDebts(b);
  const ms = performance.now() - start;
  assert.deepEqual(netAfter(b, p).filter((x) => x !== 0), []);
  assert.ok(p.length <= 19);
  assert.ok(ms < 3000, `took ${ms}ms`);
});

test('more than 20 people falls back to greedy and still clears everyone', () => {
  const cents = Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? 1 : -1) * (500 + i));
  cents.push(-cents.reduce((a, b) => a + b, 0));
  const b = bal(...cents);
  const p = simplifyDebts(b);
  assert.deepEqual(netAfter(b, p).filter((x) => x !== 0), []);
});
