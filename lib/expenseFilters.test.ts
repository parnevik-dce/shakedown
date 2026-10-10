import assert from 'node:assert/strict';
import { test } from 'node:test';

import { filterAndSortExpenses, filterPeople, matchesQuery, type FilterableExpense } from './expenseFilters.ts';

const x = (
  description: string,
  amountCents: number,
  expenseDate: string,
  createdAt: string,
  splitUserIds: string[] = ['me', 'sam']
): FilterableExpense => ({
  description,
  amountCents,
  expenseDate,
  createdAt,
  splitPeople: splitUserIds.map((userId) => ({ userId })),
});

const groceries = x('Groceries', 4250, '2026-10-01', '2026-10-05T10:00:00Z');
const pizza = x('Pizza night', 1800, '2026-10-03', '2026-10-03T20:00:00Z', ['me', 'alex']);
const rent = x('October rent', 120000, '2026-10-01', '2026-10-02T08:00:00Z', ['me', 'sam', 'alex']);
const all = [groceries, pizza, rent];
const names = (items: FilterableExpense[]) => items.map((i) => i.description);

test('search matches description case-insensitively and partially', () => {
  assert.equal(matchesQuery(pizza, 'PIZ'), true);
  assert.equal(matchesQuery(pizza, 'night'), true);
  assert.equal(matchesQuery(pizza, 'sushi'), false);
  assert.equal(matchesQuery(pizza, '   '), true);
  assert.equal(matchesQuery(pizza, ''), true);
});

test('search matches amounts however they are typed', () => {
  assert.equal(matchesQuery(groceries, '42'), true);
  assert.equal(matchesQuery(groceries, '42.5'), true);
  assert.equal(matchesQuery(groceries, '42.50'), true);
  assert.equal(matchesQuery(groceries, '$42.50'), true);
  assert.equal(matchesQuery(groceries, '43'), false);
  assert.equal(matchesQuery(rent, '1,200'), true);
  assert.equal(matchesQuery(rent, '$1200.00'), true);
  assert.equal(matchesQuery(rent, '1,300'), false);
});

test('search needs every word to match, in the description or the amount', () => {
  assert.equal(matchesQuery(groceries, 'groceries 42'), true);
  assert.equal(matchesQuery(groceries, 'groceries 99'), false);
  assert.equal(matchesQuery(groceries, 'pizza 42'), false);
});

test('a lone "$" or "." is not treated as a number', () => {
  assert.equal(matchesQuery(groceries, '$'), false);
  assert.equal(matchesQuery(groceries, '.'), false);
});

test('sort by expense date, ties broken by when they were entered', () => {
  assert.deepEqual(names(filterAndSortExpenses(all, { query: '', personId: null, sort: 'date-desc' })), [
    'Pizza night',
    'Groceries', // same date as rent, entered later
    'October rent',
  ]);
  assert.deepEqual(names(filterAndSortExpenses(all, { query: '', personId: null, sort: 'date-asc' })), [
    'October rent',
    'Groceries',
    'Pizza night',
  ]);
});

test('sort by date entered, both directions', () => {
  assert.deepEqual(names(filterAndSortExpenses(all, { query: '', personId: null, sort: 'entered-desc' })), [
    'Groceries',
    'Pizza night',
    'October rent',
  ]);
  assert.deepEqual(names(filterAndSortExpenses(all, { query: '', personId: null, sort: 'entered-asc' })), [
    'October rent',
    'Pizza night',
    'Groceries',
  ]);
});

test('person filter keeps only expenses that person is split on', () => {
  assert.deepEqual(names(filterAndSortExpenses(all, { query: '', personId: 'sam', sort: 'date-desc' })), [
    'Groceries',
    'October rent',
  ]);
  assert.deepEqual(names(filterAndSortExpenses(all, { query: '', personId: 'nobody', sort: 'date-desc' })), []);
});

test('search, person filter and sort combine', () => {
  const out = filterAndSortExpenses(all, { query: 'o', personId: 'alex', sort: 'entered-asc' });
  assert.deepEqual(names(out), ['October rent']); // "Pizza night" has no 'o'
});

test('filtering and sorting never change the original list', () => {
  const copy = [...all];
  filterAndSortExpenses(all, { query: 'zzz', personId: 'sam', sort: 'entered-asc' });
  assert.deepEqual(all, copy);
});

test('filter people: me first, then by name, and keeps former members', () => {
  const members = [
    { userId: 'sam', name: 'Sam' },
    { userId: 'me', name: 'Paul' },
  ];
  const fromExpenses = [
    { userId: 'zed', name: 'Zed (left)' },
    { userId: 'sam', name: 'Sam' },
    { userId: 'alex', name: 'Alex' },
  ];
  assert.deepEqual(
    filterPeople(members, fromExpenses, 'me').map((p) => p.userId),
    ['me', 'alex', 'sam', 'zed']
  );
});
