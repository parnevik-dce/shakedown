import { formatCents } from './money.ts';

export type NudgeDebt = { debtorName: string; creditorName: string; cents: number };

// Playful, not mean — teasing about money, never about the person. Randomized so
// repeat nudges don't feel like the exact same nag copy-pasted every time.
const OPENERS = [
  (group: string) => `🚨 SETTLE UP ALERT 🚨\n${group}, the debt gods are watching.`,
  (group: string) => `Hi, it's your friendly neighborhood balance reminder, coming in HOT 🔥\n(${group})`,
  (group: string) => `📢 This is not a drill. ${group} has unfinished business:`,
  () => `Gentle reminder that money doesn't grow on trees, but debts sure do grow on people who ignore them 👀`,
  (group: string) => `🕵️ Someone in ${group} owes money. I'm not naming names.\n(I'm naming names below.)`,
  (group: string) => `${group} financial update, brought to you by mild guilt-tripping:`,
];

const CLOSERS = [
  'Venmo, Zelle, cash, or interpretive dance — just make it happen. 💸',
  'No pressure. (Extreme pressure.) 😇',
  'Settle up before it becomes A Whole Thing.',
  "Settle up, legends. I believe in you. Mostly.",
  "This message will not stop until balances hit $0.00. That's a promise, not a threat. (It's a threat.)",
  'Sent with love, and a mild sense of financial urgency.',
];

function randomOf<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** A funny, not-actually-mean reminder to share via the share sheet. */
export function buildNudgeMessage(groupName: string, debts: NudgeDebt[]): string {
  const lines = debts.map((d) => `• ${d.debtorName} owes ${d.creditorName} ${formatCents(d.cents)}`).join('\n');
  return `${randomOf(OPENERS)(groupName)}\n\n${lines}\n\n${randomOf(CLOSERS)}`;
}
