import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { formatDateTime } from './time.ts';

// Intl may use a narrow no-break space before AM/PM; compare with normal spaces.
const plain = (s: string) => s.replace(/\s/g, ' ');
const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});
const inZone = (tz: string, iso: string) => {
  process.env.TZ = tz;
  return plain(formatDateTime(iso));
};

test('formatDateTime shows the date, the time, and the zone code', () => {
  assert.equal(inZone('America/Los_Angeles', '2026-10-05T22:12:00Z'), 'Oct 5, 2026 at 3:12 PM PDT');
  assert.equal(inZone('America/New_York', '2026-10-05T22:12:00Z'), 'Oct 5, 2026 at 6:12 PM EDT');
});

test('formatDateTime uses the zone as it was at that moment (daylight saving)', () => {
  assert.equal(inZone('America/Los_Angeles', '2026-01-05T20:05:00Z'), 'Jan 5, 2026 at 12:05 PM PST');
});

test('formatDateTime converts to the device zone, including the date', () => {
  // 02:30 UTC on Oct 6 is still the evening of Oct 5 in Los Angeles.
  assert.equal(inZone('America/Los_Angeles', '2026-10-06T02:30:00Z'), 'Oct 5, 2026 at 7:30 PM PDT');
  assert.equal(inZone('UTC', '2026-10-06T02:30:00Z'), 'Oct 6, 2026 at 2:30 AM UTC');
});

test('zones without a common abbreviation fall back to an offset', () => {
  assert.equal(inZone('Asia/Tokyo', '2026-10-05T22:12:00Z'), 'Oct 6, 2026 at 7:12 AM GMT+9');
});
