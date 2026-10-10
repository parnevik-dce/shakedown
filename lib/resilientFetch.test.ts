import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isJwtIssuedAtFuture, withJwtSkewRetry } from './resilientFetch.ts';

const SKEW_BODY = JSON.stringify({ code: 'PGRST303', details: null, hint: null, message: 'JWT issued at future' });
const skew = () => new Response(SKEW_BODY, { status: 401, headers: { 'Content-Type': 'application/json' } });
const ok = () => new Response('[]', { status: 200 });

/** A fetch that plays back the given responses in order and records every call. */
function scripted(...responses: (() => Response)[]) {
  const calls: { input: unknown; init?: RequestInit }[] = [];
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    return next();
  };
  return { fetchFn, calls };
}
const sleeps: number[] = [];
const sleep = async (ms: number) => {
  sleeps.push(ms);
};
const run = (fetchFn: ReturnType<typeof scripted>['fetchFn'], delaysMs = [1000, 2000]) => {
  sleeps.length = 0;
  return withJwtSkewRetry(fetchFn, { delaysMs, sleep });
};

test('detects the PostgREST "issued at future" rejection', () => {
  assert.equal(isJwtIssuedAtFuture(401, SKEW_BODY), true);
  assert.equal(isJwtIssuedAtFuture(401, 'jwt issued at the future'), true);
  assert.equal(isJwtIssuedAtFuture(401, '{"message":"JWT expired"}'), false);
  assert.equal(isJwtIssuedAtFuture(400, SKEW_BODY), false);
  assert.equal(isJwtIssuedAtFuture(200, ''), false);
});

test('a normal response goes straight through with no waiting', async () => {
  const { fetchFn, calls } = scripted(ok);
  const res = await run(fetchFn)('https://x.test/rest/v1/groups');
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(sleeps, []);
});

test('retries once after the skew error and returns the good response', async () => {
  const { fetchFn, calls } = scripted(skew, ok);
  const res = await run(fetchFn)('https://x.test/rest/v1/groups');
  assert.equal(res.status, 200);
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [1000]);
});

test('retries up to twice, then gives up and returns the error, body still readable', async () => {
  const { fetchFn, calls } = scripted(skew);
  const res = await run(fetchFn)('https://x.test/rest/v1/groups');
  assert.equal(res.status, 401);
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [1000, 2000]);
  assert.match(await res.text(), /issued at future/);
});

test('a retried write sends exactly the same request', async () => {
  const { fetchFn, calls } = scripted(skew, ok);
  const init = { method: 'POST', body: '{"p_amount":4250}', headers: { Authorization: 'Bearer abc' } };
  await run(fetchFn)('https://x.test/rest/v1/rpc/save_expense', init);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], calls[0]);
});

test('other errors are not retried', async () => {
  for (const make of [
    () => new Response('{"message":"JWT expired"}', { status: 401 }),
    () => new Response('{"message":"permission denied"}', { status: 403 }),
    () => new Response('{"message":"bad"}', { status: 400 }),
    () => new Response('oops', { status: 500 }),
  ]) {
    const { fetchFn, calls } = scripted(make);
    const res = await run(fetchFn)('https://x.test/rest/v1/groups');
    assert.equal(calls.length, 1);
    assert.deepEqual(sleeps, []);
    assert.ok(res.status >= 400);
  }
});

test('network failures propagate without retrying', async () => {
  let calls = 0;
  const failing = async () => {
    calls++;
    throw new TypeError('Network request failed');
  };
  await assert.rejects(run(failing)('https://x.test/rest/v1/groups'), /Network request failed/);
  assert.equal(calls, 1);
});

test('a Request object (body can only be sent once) is not replayed', async () => {
  const { fetchFn, calls } = scripted(skew, ok);
  const res = await run(fetchFn)(new Request('https://x.test/rest/v1/groups'));
  assert.equal(res.status, 401);
  assert.equal(calls.length, 1);
});
