// Server-only Supabase client backed by the SERVICE ROLE key. This BYPASSES
// Row-Level Security, so it must NEVER be imported into the browser bundle and
// must only be used for the narrow set of operations that genuinely cannot run
// under a user session:
//
//   * inserting a verified passkey credential during signup (prod has no
//     session yet at that point — see server/passkeys.ts);
//   * `auth.admin.generateLink` to mint a magic-link token when bridging a
//     verified passkey assertion into a real Supabase session.
//
// The key comes from SUPABASE_SERVICE_ROLE_KEY (server env, never VITE_-prefixed
// so it can't be inlined into the client bundle). There is no default: if it is
// missing, passkey operations fail loudly rather than silently degrading.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "~/lib/supabaseConfig";

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdminClient() {
  if (client) return client;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Passkey registration and the " +
        "passkey→session bridge require the service-role key (server-only).",
    );
  }

  client = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
