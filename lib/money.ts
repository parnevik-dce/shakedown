const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Format integer cents as a USD string, e.g. 1760 -> "$17.60". */
export function formatCents(cents: number): string {
  return usd.format(Math.abs(cents) / 100);
}
