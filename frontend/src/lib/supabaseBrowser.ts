// Browser-side Supabase client (singleton). Used by the signup / sign-in / and
// onboarding routes to run the auth ceremonies and call RPCs as the signed-in
// user. Cookie storage is handled by @supabase/ssr so the session is readable by
// the server middleware (the session gate) on the next request.
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabaseConfig";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (client) return client;
  client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
