// Server-only Supabase client, backed by the request's cookies via
// @supabase/ssr. This client carries the signed-in user's session, so every
// query runs under that user's Row-Level Security context (see
// supabase/migrations) — it is NOT the service_role key and cannot bypass RLS.
//
// Use it inside `createServerFn` handlers and route loaders to:
//   * read the current auth user (`getServerUser`)
//   * call RLS-scoped RPCs on the user's behalf (e.g. create_tenant)
//
// Cookie plumbing uses TanStack Start's request-scoped cookie helpers so the
// session Supabase issues on the browser is visible here, and any refreshed
// tokens are written back to the response.
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { getRequest, setCookie } from "@tanstack/react-start/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "~/lib/supabaseConfig";

export function getSupabaseServerClient() {
  const request = getRequest();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        const header = request.headers.get("cookie") ?? "";
        // parseCookieHeader can yield undefined values; normalize to strings.
        return parseCookieHeader(header).map((c) => ({
          name: c.name,
          value: c.value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options);
        }
      },
    },
  });
}

/** The current authenticated Supabase user, or null. Safe on public routes. */
export async function getServerUser() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
