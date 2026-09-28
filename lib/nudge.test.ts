import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildNudgeMessage } from './nudge.ts';

test('buildNudgeMessage includes every debt with names and amounts', () => {
  const msg = buildNudgeMessage('Apt 4B', [
    { debtorName: 'Maya R.', creditorName: 'You', cents: 2160 },
    { debtorName: 'Devon K.', creditorName: 'Priya S.', cents: 4000 },
  ]);
  assert.match(msg, /Maya R\. owes You \$21\.60/);
  assert.match(msg, /Devon K\. owes Priya S\. \$40\.00/);
  assert.match(msg, /Apt 4B/);
});

test('buildNudgeMessage varies its wording across calls', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 30; i++) {
    seen.add(buildNudgeMessage('Group', [{ debtorName: 'A', creditorName: 'B', cents: 100 }]));
  }
  assert.ok(seen.size > 1, 'expected more than one distinct message across 30 calls');
});

test('buildNudgeMessage never reads as an insult -- no name-calling or demeaning language', () => {
  const banned = /\b(stupid|idiot|pathetic|loser|deadbeat|shame on you|worthless)\b/i;
  for (let i = 0; i < 30; i++) {
    const msg = buildNudgeMessage('Group', [{ debtorName: 'A', creditorName: 'B', cents: 100 }]);
    assert.doesNotMatch(msg, banned, msg);
  }
});
