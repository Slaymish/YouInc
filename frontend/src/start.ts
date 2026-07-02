import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

const SESSION_COOKIE = "youinc_session";
const LOGIN_PATH = "/login";

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
 * Passkey session gate. Full-page (router) requests without a valid session
 * cookie are redirected to /login. The login page and static assets stay open,
 * and server functions gate themselves via `requireSession()` in auth.ts so
 * data never leaves the server without a session (defense in depth).
 */
const sessionGate = createMiddleware().server(async ({ next, request, pathname, handlerType }) => {
  if (handlerType !== "router" || pathname === LOGIN_PATH) {
    return next();
  }

  const { isValidSession } = await import("~/server/auth");
  if (isValidSession(readCookie(request, SESSION_COOKIE))) {
    return next();
  }

  return new Response(null, { status: 302, headers: { Location: LOGIN_PATH } });
});

// Defining a custom start.ts disables Start's automatic CSRF middleware, so
// it must be re-added explicitly to keep server functions protected.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [sessionGate, csrfMiddleware],
}));
