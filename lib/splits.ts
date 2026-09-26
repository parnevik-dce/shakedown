// Pure split math. All money is integer cents; percentages are integer thousandths
// (33.333% = 33333) so nothing here touches floating point. The invariant every
// function upholds: the returned owed amounts add up to exactly the total.

export type SplitMethod = 'equal' | 'exact' | 'percent';

export type Split = {
  userId: string;
  owedCents: number;
  /** Only set for percent splits, e.g. 33.333 */
  percent: number | null;
};

export const PERCENT_TOTAL = 100_000; // 100.000% in thousandths

/** Divide evenly; leftover cents go one each to the first people in the list. */
export function equalSplit(totalCents: number, userIds: string[]): Split[] {
  const n = userIds.length;
  if (n === 0) return [];
  const base = Math.floor(totalCents / n);
  const extra = totalCents - base * n;
  return userIds.map((userId, i) => ({ userId, owedCents: base + (i < extra ? 1 : 0), percent: null }));
}

/**
 * Split by percentage using the largest-remainder method so the cents always sum
 * to the total. Caller must ensure thousandths sum to PERCENT_TOTAL.
 */
export function percentSplit(totalCents: number, entries: { userId: string; thousandths: number }[]): Split[] {
  const rows = entries.map((e, index) => {
    const scaled = totalCents * e.thousandths; // < 2^53 for our limits
    return { ...e, index, cents: Math.floor(scaled / PERCENT_TOTAL), fraction: scaled % PERCENT_TOTAL };
  });
  let leftover = totalCents - rows.reduce((sum, r) => sum + r.cents, 0);
  const byFraction = [...rows].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const r of byFraction) {
    if (leftover <= 0) break;
    r.cents += 1;
    leftover -= 1;
  }
  return rows.map((r) => ({ userId: r.userId, owedCents: r.cents, percent: r.thousandths / 1000 }));
}

/** Even percentages that add up to exactly 100%, e.g. 3 people -> 33.334 / 33.333 / 33.333. */
export function defaultThousandths(n: number): number[] {
  if (n === 0) return [];
  const base = Math.floor(PERCENT_TOTAL / n);
  const extra = PERCENT_TOTAL - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Parse "33.333" -> 33333. Null if empty, negative, over 100, or more than 3 decimals. */
export function parsePercent(text: string): number | null {
  const cleaned = text.replace(/[%\s]/g, '');
  if (!/^(\d+\.?\d{0,3}|\.\d{1,3})$/.test(cleaned)) return null;
  const [whole = '', frac = ''] = cleaned.split('.');
  const thousandths = Number(whole || '0') * 1000 + Number(frac.padEnd(3, '0') || '0');
  return thousandths > PERCENT_TOTAL ? null : thousandths;
}

export function thousandthsToInput(thousandths: number): string {
  return String(thousandths / 1000);
}

export type SplitInput = {
  userId: string;
  included: boolean;
  /** Raw text for exact ($) or percent (%) methods. Ignored for equal. */
  text: string;
};

export type SplitCheck =
  | { ok: true; splits: Split[]; summary: string }
  | { ok: false; error: string; summary: string };

/**
 * Turn the form's split state into final splits, or say what's wrong. `summary`
 * is the running footer text (e.g. "$0.00 left").
 */
export function checkSplit(
  method: SplitMethod,
  totalCents: number | null,
  inputs: SplitInput[],
  parseExact: (text: string) => number | null,
  formatMoney: (cents: number) => string
): SplitCheck {
  const chosen = inputs.filter((i) => i.included);
  if (chosen.length === 0) return { ok: false, error: 'Include at least one person.', summary: 'No one selected' };

  if (method === 'equal') {
    if (totalCents === null) return { ok: false, error: 'Enter an amount.', summary: `Split ${chosen.length} ways` };
    const splits = equalSplit(totalCents, chosen.map((c) => c.userId));
    const each = formatMoney(splits[0].owedCents);
    return {
      ok: true,
      splits,
      summary: `Split ${chosen.length} way${chosen.length === 1 ? '' : 's'} · ${each}${splits.some((s) => s.owedCents !== splits[0].owedCents) ? '+' : ''} each`,
    };
  }

  if (method === 'exact') {
    const cents = chosen.map((c) => parseExact(c.text));
    const assigned = cents.reduce<number>((sum, c) => sum + (c ?? 0), 0);
    const total = totalCents ?? 0;
    const left = total - assigned;
    const summary = `Assigned ${formatMoney(assigned)} of ${formatMoney(total)} · ${
      left === 0 ? '$0.00' : left > 0 ? formatMoney(left) : `${formatMoney(-left)} over`
    } ${left < 0 ? '' : 'left'}`.trim();
    if (totalCents === null) return { ok: false, error: 'Enter an amount.', summary };
    if (cents.some((c) => c === null)) return { ok: false, error: 'Enter an amount for everyone included.', summary };
    if (left !== 0) return { ok: false, error: 'Amounts must add up to the expense total.', summary };
    return {
      ok: true,
      summary,
      splits: chosen.map((c, i) => ({ userId: c.userId, owedCents: cents[i] as number, percent: null })),
    };
  }

  const parsed = chosen.map((c) => parsePercent(c.text));
  const assigned = parsed.reduce<number>((sum, p) => sum + (p ?? 0), 0);
  const left = PERCENT_TOTAL - assigned;
  const pct = (t: number) => `${t / 1000}%`;
  const summary = `Assigned ${pct(assigned)} of 100% · ${left < 0 ? `${pct(-left)} over` : `${pct(left)} left`}`;
  if (totalCents === null) return { ok: false, error: 'Enter an amount.', summary };
  if (parsed.some((p) => p === null)) return { ok: false, error: 'Enter a percentage for everyone included.', summary };
  if (left !== 0) return { ok: false, error: 'Percentages must add up to 100%.', summary };
  return {
    ok: true,
    summary,
    splits: percentSplit(
      totalCents,
      chosen.map((c, i) => ({ userId: c.userId, thousandths: parsed[i] as number }))
    ),
  };
}
