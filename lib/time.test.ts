import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatDateTime } from './time.ts';

// Intl may use a narrow no-break space before AM/PM; compare with normal spaces.
const plain = (s: string) => s.replace(/\s/g, ' ');

test('formatDateTime shows the full date and the time', () => {
  assert.equal(plain(formatDateTime(new Date(2026, 9, 5, 15, 12).toISOString())), 'Oct 5, 2026 at 3:12 PM');
  assert.equal(plain(formatDateTime(new Date(2025, 0, 1, 0, 5).toISOString())), 'Jan 1, 2025 at 12:05 AM');
  assert.equal(plain(formatDateTime(new Date(2026, 11, 31, 12, 0).toISOString())), 'Dec 31, 2026 at 12:00 PM');
});
