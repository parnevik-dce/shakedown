type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Waits before each retry; two retries, so a stuck request fails after about 3 seconds. */
export const RETRY_DELAYS_MS = [1000, 2000];

const sleepFor = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * PostgREST rejects a token whose "issued at" time is ahead of its own clock, with no
 * tolerance. A token refreshed a moment ago (as happens on opening the app after a while)
 * can briefly look like it's from the future; the same request succeeds a second later.
 */
export function isJwtIssuedAtFuture(status: number, bodyText: string): boolean {
  return status === 401 && /issued at (the )?future/i.test(bodyText);
}

/**
 * Wraps fetch so a request rejected only because its token looks "issued in the future"
 * is retried after a short delay. Safe for writes too: the request is refused during
 * authentication, before anything runs. Every other response, and network errors, pass
 * straight through untouched.
 */
export function withJwtSkewRetry(
  baseFetch: FetchLike,
  opts: { delaysMs?: number[]; sleep?: (ms: number) => Promise<void> } = {}
): FetchLike {
  const delaysMs = opts.delaysMs ?? RETRY_DELAYS_MS;
  const sleep = opts.sleep ?? sleepFor;

  return async (input, init) => {
    let response = await baseFetch(input, init);
    // A Request object's body can only be sent once, so those can't be replayed.
    if (typeof Request !== 'undefined' && input instanceof Request) return response;

    for (const delay of delaysMs) {
      if (response.status !== 401) return response;
      const body = await response.clone().text().catch(() => '');
      if (!isJwtIssuedAtFuture(response.status, body)) return response;
      await sleep(delay);
      response = await baseFetch(input, init);
    }
    return response;
  };
}
