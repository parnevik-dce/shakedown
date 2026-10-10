export type SortKey = 'date-desc' | 'date-asc' | 'entered-desc' | 'entered-asc';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date-desc', label: 'Expense date, newest' },
  { key: 'date-asc', label: 'Expense date, oldest' },
  { key: 'entered-desc', label: 'Date entered, newest' },
  { key: 'entered-asc', label: 'Date entered, oldest' },
];

export type FilterableExpense = {
  description: string;
  amountCents: number;
  /** Calendar date of the expense, "YYYY-MM-DD". */
  expenseDate: string;
  /** When the expense was entered (ISO timestamp). */
  createdAt: string;
  /** Everyone with a share in the split. */
  splitPeople: { userId: string }[];
};

/** "$1,042.50" -> "1042.50"; null if the token isn't a plain number. */
function numericToken(token: string): string | null {
  const cleaned = token.replace(/[$,]/g, '');
  return /^\d*\.?\d*$/.test(cleaned) && /\d/.test(cleaned) ? cleaned : null;
}

/**
 * Every word typed must match the description (case-insensitive, partial) or the
 * amount (digits typed appear in the dollars-and-cents amount, so "42", "42.5" and
 * "$42.50" all find a $42.50 expense). Empty search matches everything.
 */
export function matchesQuery(item: Pick<FilterableExpense, 'description' | 'amountCents'>, query: string): boolean {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const description = item.description.toLowerCase();
  const amount = (item.amountCents / 100).toFixed(2);
  return tokens.every((token) => {
    if (description.includes(token.toLowerCase())) return true;
    const digits = numericToken(token);
    return digits !== null && amount.includes(digits);
  });
}

export function matchesPerson(item: Pick<FilterableExpense, 'splitPeople'>, personId: string | null): boolean {
  return personId === null || item.splitPeople.some((p) => p.userId === personId);
}

function compare(a: FilterableExpense, b: FilterableExpense, sort: SortKey): number {
  const byDate = a.expenseDate.localeCompare(b.expenseDate);
  const byEntered = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  switch (sort) {
    case 'date-desc':
      return -(byDate || byEntered);
    case 'date-asc':
      return byDate || byEntered;
    case 'entered-desc':
      return -(byEntered || byDate);
    case 'entered-asc':
      return byEntered || byDate;
  }
}

/** Search + person filter + sort, without touching the input. Ties keep their original order. */
export function filterAndSortExpenses<T extends FilterableExpense>(
  items: T[],
  opts: { query: string; personId: string | null; sort: SortKey }
): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => matchesQuery(item, opts.query) && matchesPerson(item, opts.personId))
    .sort((a, b) => compare(a.item, b.item, opts.sort) || a.index - b.index)
    .map(({ item }) => item);
}

export type Person = { userId: string; name: string };

/**
 * People the filter can offer: current members plus anyone (e.g. someone who has
 * since left) who still appears on an expense. Me first, then by name.
 */
export function filterPeople(
  members: Person[],
  expensePeople: Person[],
  myId: string
): Person[] {
  const byId = new Map<string, Person>();
  for (const p of [...expensePeople, ...members]) byId.set(p.userId, p);
  return [...byId.values()].sort((a, b) =>
    a.userId === myId ? -1 : b.userId === myId ? 1 : a.name.localeCompare(b.name)
  );
}
