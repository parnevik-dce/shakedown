import assert from 'node:assert/strict';
import { test } from 'node:test';

import { centsToInput, formatCents, parseDollars } from './money.ts';
import { autoFillTwoPersonExact, checkSplit, defaultThousandths, equalSplit, parsePercent, percentSplit } from './splits.ts';

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

// --- two-person exact split auto-fill -------------------------------------
const slot = (userId: string, text = '', included = true) => ({ userId, included, text });
const fill = (inputs: ReturnType<typeof slot>[], anchor: string, total: number | null) =>
  autoFillTwoPersonExact(inputs, anchor, total, parseDollars, centsToInput);
const texts = (inputs: ReturnType<typeof slot>[]) => inputs.map((i) => i.text);

test('auto-fill: the other person gets the remainder', () => {
  assert.deepEqual(texts(fill([slot('a', '12'), slot('b')], 'a', 5000)), ['12', '38.00']);
  assert.deepEqual(texts(fill([slot('a', '12.5'), slot('b', '25.00')], 'a', 5000)), ['12.5', '37.50']);
});

test('auto-fill: works whichever field is edited', () => {
  assert.deepEqual(texts(fill([slot('a', '25.00'), slot('b', '10')], 'b', 5000)), ['40.00', '10']);
});

test('auto-fill: the two always add up to the cent, and the form accepts the result', () => {
  const out = fill([slot('a', '3.33'), slot('b')], 'a', 1000);
  assert.deepEqual(texts(out), ['3.33', '6.67']);
  assert.equal(checkSplit('exact', 1000, out, parseDollars, formatCents).ok, true);
});

test('auto-fill: reads amounts typed with $ and commas', () => {
  assert.deepEqual(texts(fill([slot('a', '$1,000'), slot('b')], 'a', 150000)), ['$1,000', '500.00']);
});

test('auto-fill: an amount over the total leaves the other field empty, not negative', () => {
  assert.deepEqual(texts(fill([slot('a', '60'), slot('b', '25.00')], 'a', 5000)), ['60', '']);
});

test('auto-fill: an amount equal to the total leaves the other at zero', () => {
  assert.deepEqual(texts(fill([slot('a', '50'), slot('b')], 'a', 5000)), ['50', '0.00']);
});

test('auto-fill: blank or invalid input leaves the other field alone', () => {
  const inputs = [slot('a', ''), slot('b', '25.00')];
  assert.equal(fill(inputs, 'a', 5000), inputs);
  const bad = [slot('a', 'abc'), slot('b', '25.00')];
  assert.equal(fill(bad, 'a', 5000), bad);
});

test('auto-fill: needs a total and exactly two people', () => {
  const two = [slot('a', '12'), slot('b')];
  assert.equal(fill(two, 'a', null), two);
  assert.equal(fill(two, 'a', 0), two);
  const three = [slot('a', '12'), slot('b'), slot('c')];
  assert.equal(fill(three, 'a', 5000), three);
  const one = [slot('a', '12'), slot('b', '', false)];
  assert.equal(fill(one, 'a', 5000), one);
});

test('auto-fill: someone left out of the split is ignored and left untouched', () => {
  const out = fill([slot('a', '12'), slot('b'), slot('c', '7', false)], 'a', 5000);
  assert.deepEqual(texts(out), ['12', '38.00', '7']);
});

test('auto-fill: an anchor who is not one of the two included people does nothing', () => {
  const inputs = [slot('a', '12'), slot('b', '5'), slot('c', '7', false)];
  assert.equal(fill(inputs, 'c', 5000), inputs);
  assert.equal(fill(inputs, 'nobody', 5000), inputs);
});

test('auto-fill: changing the total recalculates from the anchored field', () => {
  const typed = fill([slot('a', '12'), slot('b')], 'a', 5000); // b = 38.00
  assert.deepEqual(texts(fill(typed, 'a', 8000)), ['12', '68.00']);
});

test('auto-fill: never modifies the array it is given', () => {
  const inputs = [slot('a', '12'), slot('b')];
  const snapshot = JSON.stringify(inputs);
  fill(inputs, 'a', 5000);
  assert.equal(JSON.stringify(inputs), snapshot);
});
