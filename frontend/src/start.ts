import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";

const SESSION_COOKIE = "youinc_session";
const LOGIN_PATH = "/login";

// The passkey session gate used to protect ONLY the local owner's private
// SQLite dashboard surface (`/dashboard`), which has been retired along with
// `server/ledger.ts` — the owner now uses the self-service Supabase-backed
// `/workspace` like any other tenant. Nothing is currently listed here, so
// this gate is a no-op; `/login`'s passkey ceremony and `server/auth.ts`
// remain in place (unused) rather than being torn out in the same change
// that retires the dashboard.
//
// This is a protected-prefix model, deliberately inverted from an allowlist:
// adding a new public page must never require touching this file (the old
// allowlist silently 302'd any un-listed route to /login). The Supabase-gated
// routes gate themselves on the Supabase session inside their own loaders.
const PROTECTED_PREFIXES: string[] = [];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/**
 * Passkey session gate. Full-page (router) requests to a PROTECTED path without
 * a valid session cookie are redirected to /login. Everything else stays open,
 * and server functions gate themselves via `requireSession()` in auth.ts so
 * data never leaves the server without a session (defense in depth).
 */
const sessionGate = createMiddleware().server(
  async ({ next, request, pathname, handlerType }) => {
    if (handlerType !== "router" || !isProtectedPath(pathname)) {
      return next();
    }

    const { isValidSession } = await import("~/server/auth");
    if (isValidSession(readCookie(request, SESSION_COOKIE))) {
      return next();
    }

    return new Response(null, {
      status: 302,
      headers: { Location: LOGIN_PATH },
    });
  },
);

// Defining a custom start.ts disables Start's automatic CSRF middleware, so
// it must be re-added explicitly to keep server functions protected.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [sessionGate, csrfMiddleware],
}));
