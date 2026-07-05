import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { EmailOtpType } from "@supabase/supabase-js";

// Email-confirmation callback. Supabase's confirmation email links here with a
// token_hash + type (see the "Confirm signup" email template). We exchange the
// token for a session with verifyOtp — which, unlike the PKCE code flow, works
// cross-device (the confirm link opened on a phone has no code_verifier). The
// server client writes the session cookies, then we redirect into onboarding.
const confirmToken = createServerFn({ method: "GET" })
  .validator((data: { tokenHash: string; type: string }) => data)
  .handler(async ({ data }) => {
    const { getSupabaseServerClient } = await import("~/server/supabaseServer");
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: data.tokenHash,
      type: data.type as EmailOtpType,
    });
    return { ok: !error };
  });

export const Route = createFileRoute("/auth/confirm")({
  validateSearch: (search: Record<string, unknown>) => ({
    token_hash: typeof search.token_hash === "string" ? search.token_hash : "",
    type: typeof search.type === "string" ? search.type : "email",
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (!deps.token_hash) throw redirect({ to: "/signin" });
    const { ok } = await confirmToken({ data: { tokenHash: deps.token_hash, type: deps.type } });
    throw redirect({ to: ok ? "/onboarding" : "/signin" });
  },
  component: () => null,
});
