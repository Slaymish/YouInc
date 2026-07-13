// GET /api/akahu/callback — the Akahu OAuth2 redirect target. Validates the
// CSRF state cookie, exchanges the authorization code for the caller's
// enduring user token, and stores it via the same Vault path the old
// paste-a-token flow used (connectAkahu), so the rest of the sync pipeline is
// unchanged. See api.akahu.oauth.start.ts for the server-route mechanism.
//
// SECURITY: never log or forward `code` / `client_secret` / the access token.
// Errors are mapped to a short opaque code in the redirect query string only.
import { createFileRoute } from "@tanstack/react-router";

const STATE_COOKIE = "akahu_oauth_state";
const USER_COOKIE = "akahu_oauth_user";

function redirectToWorkspace(query: string): Response {
  // Bank connection lives on the workspace Settings tab; land the user there
  // so AkahuConnectPanel (which reads window.location) can pick up the result.
  return new Response(null, { status: 302, headers: { Location: `/workspace/settings?${query}` } });
}

export const Route = createFileRoute("/api/akahu/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getCookie, deleteCookie } = await import("@tanstack/react-start/server");
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const cookieState = getCookie(STATE_COOKIE) ?? null;
        const initiatingUserId = getCookie(USER_COOKIE) ?? null;
        // Clear the one-time CSRF cookie immediately, regardless of outcome.
        deleteCookie(STATE_COOKIE, { path: "/" });
        deleteCookie(USER_COOKIE, { path: "/" });

        const { resolveAkahuCallback } = await import("~/server/akahuConnection");
        const outcome = resolveAkahuCallback({ code, state, error }, cookieState);
        if (outcome.kind === "denied") return redirectToWorkspace("akahu_error=denied");
        if (outcome.kind === "state_mismatch") return redirectToWorkspace("akahu_error=state");

        const { getServerUser } = await import("~/server/supabaseServer");
        const user = await getServerUser();
        if (!user || user.id !== initiatingUserId) {
          return redirectToWorkspace("akahu_error=state");
        }

        try {
          const { exchangeAkahuOAuthCode, connectAkahu } = await import(
            "~/server/akahuConnection"
          );
          const accessToken = await exchangeAkahuOAuthCode(outcome.code);
          await connectAkahu(accessToken);
        } catch (err) {
          // Safe to log: exchangeAkahuOAuthCode's error messages never
          // include the code or client_secret, and connectAkahu's errors
          // never include the access token.
          console.error(
            "[akahu-oauth] callback failed:",
            err instanceof Error ? err.message : "unknown error",
          );
          return redirectToWorkspace("akahu_error=exchange");
        }

        return redirectToWorkspace("akahu_connected=1");
      },
    },
  },
});
