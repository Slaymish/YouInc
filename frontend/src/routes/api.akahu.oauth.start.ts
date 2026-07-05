// GET /api/akahu/oauth/start — kicks off the Akahu OAuth2 authorization-code
// flow. Requires a signed-in tenant, generates a CSRF `state`, stashes it in
// an HttpOnly cookie, and 302s the browser to Akahu's authorize endpoint.
//
// This is a TanStack Start "server route": a file route whose `server.handlers`
// option is dispatched directly by the Nitro/h3 request handler for an exact
// path match, without rendering any UI (see start-server-core's
// createStartHandler.js `handleServerRoutes` — it calls
// `foundRoute.options.server.handlers[method]` before falling through to the
// router's page-render path). No `component` is exported here.
import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";

const STATE_COOKIE = "akahu_oauth_state";
const STATE_COOKIE_MAX_AGE_SECONDS = 600;

function redirectToWorkspace(query: string): Response {
  return new Response(null, { status: 302, headers: { Location: `/workspace?${query}` } });
}

export const Route = createFileRoute("/api/akahu/oauth/start")({
  server: {
    handlers: {
      GET: async () => {
        const { getServerUser } = await import("~/server/supabaseServer");
        const user = await getServerUser();
        if (!user) return redirectToWorkspace("akahu_error=auth");

        const { oauthConfigured, buildAkahuAuthorizeUrl } = await import(
          "~/server/akahuConnection"
        );
        if (!oauthConfigured()) return redirectToWorkspace("akahu_error=not_configured");

        const { setCookie } = await import("@tanstack/react-start/server");
        const state = randomBytes(32).toString("base64url");
        setCookie(STATE_COOKIE, state, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
        });

        return new Response(null, {
          status: 302,
          headers: { Location: buildAkahuAuthorizeUrl(state) },
        });
      },
    },
  },
});
