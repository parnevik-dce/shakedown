import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatCents, parseDollars } from './money.ts';
import { checkSplit, defaultThousandths, equalSplit, parsePercent, percentSplit } from './splits.ts';

const sum = (splits: { owedCents: number }[]) => splits.reduce((s, x) => s + x.owedCents, 0);
const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);

test('parseDollars accepts common inputs and rejects bad ones', () => {
  assert.equal(parseDollars('12'), 1200);
  assert.equal(parseDollars('12.5'), 1250);
  assert.equal(parseDollars('12.50'), 1250);
  assert.equal(parseDollars('$1,234.56'), 123456);
  assert.equal(parseDollars('.99'), 99);
  assert.equal(parseDollars('0.10'), 10);
  assert.equal(parseDollars('19.99'), 1999); // float math would give 1998.9999...
  assert.equal(parseDollars(''), null);
  assert.equal(parseDollars('abc'), null);
  assert.equal(parseDollars('1.234'), null);
  assert.equal(parseDollars('-5'), null);
  assert.equal(parseDollars('99999999999'), null);
});

test('equalSplit gives leftover cents to the first people and always sums to the total', () => {
  assert.deepEqual(equalSplit(1000, ids(3)).map((s) => s.owedCents), [334, 333, 333]);
  assert.deepEqual(equalSplit(1, ids(3)).map((s) => s.owedCents), [1, 0, 0]);
  assert.deepEqual(equalSplit(8400, ids(4)).map((s) => s.owedCents), [2100, 2100, 2100, 2100]);
  for (const total of [1, 2, 7, 99, 100, 1001, 123457]) {
    for (let n = 1; n <= 9; n++) assert.equal(sum(equalSplit(total, ids(n))), total);
  }
});

test('percentSplit sums exactly to the total (largest remainder)', () => {
  const thirds = ids(3).map((userId, i) => ({ userId, thousandths: defaultThousandths(3)[i] }));
  assert.equal(sum(percentSplit(1000, thirds)), 1000);
  assert.equal(sum(percentSplit(1, thirds)), 1);
  const a = percentSplit(8400, [
    { userId: 'a', thousandths: 40000 },
    { userId: 'b', thousandths: 25000 },
    { userId: 'c', thousandths: 20000 },
    { userId: 'd', thousandths: 15000 },
  ]);
  assert.deepEqual(a.map((s) => s.owedCents), [3360, 2100, 1680, 1260]);
  // awkward case: 3 x 33.333% + 0.001%
  const awkward = percentSplit(1001, [
    { userId: 'a', thousandths: 33333 },
    { userId: 'b', thousandths: 33333 },
    { userId: 'c', thousandths: 33334 },
  ]);
  assert.equal(sum(awkward), 1001);
});

test('defaultThousandths always totals 100%', () => {
  for (let n = 1; n <= 20; n++) assert.equal(defaultThousandths(n).reduce((a, b) => a + b, 0), 100000);
});

test('parsePercent', () => {
  assert.equal(parsePercent('40'), 40000);
  assert.equal(parsePercent('33.333%'), 33333);
  assert.equal(parsePercent('100'), 100000);
  assert.equal(parsePercent('100.001'), null);
  assert.equal(parsePercent('1.2345'), null);
  assert.equal(parsePercent(''), null);
});

const money = formatCents;
const person = (userId: string, text = '', included = true) => ({ userId, included, text });

test('checkSplit: equal, with someone left out', () => {
  const r = checkSplit('equal', 3000, [person('a'), person('b'), person('c', '', false)], parseDollars, money);
  assert.ok(r.ok);
  assert.deepEqual(r.splits.map((s) => [s.userId, s.owedCents]), [['a', 1500], ['b', 1500]]);
});

test('checkSplit: exact must add up', () => {
  const inputs = [person('a', '30'), person('b', '20'), person('c', '18'), person('d', '16')];
  const ok = checkSplit('exact', 8400, inputs, parseDollars, money);
  assert.ok(ok.ok);
  assert.equal(sum(ok.splits), 8400);
  const short = checkSplit('exact', 8500, inputs, parseDollars, money);
  assert.equal(short.ok, false);
  assert.match(short.summary, /\$1\.00 left/);
  const over = checkSplit('exact', 8300, inputs, parseDollars, money);
  assert.equal(over.ok, false);
  assert.match(over.summary, /over/);
  const blank = checkSplit('exact', 8400, [person('a', '84'), person('b', '')], parseDollars, money);
  assert.equal(blank.ok, false);
});

test('checkSplit: percent must total 100 and yields exact cents', () => {
  const inputs = [person('a', '40'), person('b', '25'), person('c', '20'), person('d', '15')];
  const ok = checkSplit('percent', 8400, inputs, parseDollars, money);
  assert.ok(ok.ok);
  assert.deepEqual(ok.splits.map((s) => s.percent), [40, 25, 20, 15]);
  assert.equal(sum(ok.splits), 8400);
  const bad = checkSplit('percent', 8400, [person('a', '50'), person('b', '40')], parseDollars, money);
  assert.equal(bad.ok, false);
  assert.match(bad.summary, /10% left/);
});

test('checkSplit needs an amount and at least one person', () => {
  assert.equal(checkSplit('equal', null, [person('a')], parseDollars, money).ok, false);
  assert.equal(checkSplit('equal', 100, [person('a', '', false)], parseDollars, money).ok, false);
});

import { formatWhen } from './time.ts';

test('formatWhen', () => {
  const now = new Date(2026, 7, 28, 20, 0); // Aug 28 2026, 8pm local
  assert.equal(formatWhen(new Date(2026, 7, 28, 18, 12).toISOString(), now), 'Today, 6:12 PM');
  assert.equal(formatWhen(new Date(2026, 7, 27, 9, 4).toISOString(), now), 'Yesterday, 9:04 AM');
  assert.equal(formatWhen(new Date(2026, 7, 24, 9, 0).toISOString(), now), 'Mon, Aug 24');
  assert.equal(formatWhen(new Date(2026, 5, 1, 9, 0).toISOString(), now), 'Jun 1');
  assert.equal(formatWhen(new Date(2025, 11, 31, 9, 0).toISOString(), now), 'Dec 31, 2025');
});
