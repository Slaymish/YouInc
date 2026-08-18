// Client-side cache for the root route's `authenticated` context.
//
// The root `beforeLoad` re-runs for every matched route on every navigation —
// verified against the installed router, it has no staleTime/shouldReload
// gating of its own; that only applies to `loader`. Left unguarded, every
// client-side navigation anywhere in the app would fire a server round trip to
// re-read a cookie that almost never changes.
//
// Server-side we never cache: per-request auth state held in shared module
// scope would leak one user's session into another concurrent request. On the
// client we cache for the tab's lifetime, and the sign-in / sign-up / sign-out
// handlers call `clearAuthCache` so the next navigation re-checks.
let cached: boolean | undefined;

const isBrowser = () => typeof window !== "undefined";

/** Cached value, or undefined when the session must be resolved fresh. */
export function readAuthCache(): boolean | undefined {
  return isBrowser() ? cached : undefined;
}

export function writeAuthCache(authenticated: boolean) {
  if (isBrowser()) cached = authenticated;
}

/**
 * Invalidates the cache so the next navigation re-checks the session instead of
 * serving a stale value. Call this from any handler that creates or destroys a
 * session, immediately before it navigates.
 */
export function clearAuthCache() {
  cached = undefined;
}
