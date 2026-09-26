const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Largest single amount we accept, in cents ($10,000,000.00). */
export const MAX_CENTS = 1_000_000_000;

/** Format integer cents as a USD string, e.g. 1760 -> "$17.60". Sign is dropped. */
export function formatCents(cents: number): string {
  return usd.format(Math.abs(cents) / 100);
}

/** Cents as plain editable text, e.g. 1760 -> "17.60". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Parse what a person typed as dollars into integer cents. Accepts "12", "12.5",
 * "12.50", "$1,234.56". Returns null for empty/invalid input or more than 2 decimals.
 * Done with string math, not floats, so 0.1 + 0.2 style errors can't creep in.
 */
export function parseDollars(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (!/^(\d+\.?\d{0,2}|\.\d{1,2})$/.test(cleaned)) return null;
  const [whole = '', frac = ''] = cleaned.split('.');
  const cents = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0') || '0');
  return cents > MAX_CENTS ? null : cents;
}
