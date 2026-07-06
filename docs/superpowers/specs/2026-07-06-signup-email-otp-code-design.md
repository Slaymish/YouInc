# Signup email confirmation: code instead of link

Date: 2026-07-06
Status: approved, ready for planning

## Problem

Todo (`todo.md`): "Maybe make the email confirmation send a 6-digit code to the
user's email address instead of a link, and then the confirm email screen
allows them to enter it there."

Today, signup confirmation email uses Supabase's default template: a magic
link with a `token_hash` + `type` query string pointing at `/auth/confirm`
(`frontend/src/routes/auth.confirm.tsx`), which calls
`supabase.auth.verifyOtp({ token_hash, type })` in the loader and redirects to
`/onboarding` on success. The "check your email" screens
(`frontend/src/routes/signup.password.tsx:77-121` and the equivalent branch in
`frontend/src/routes/signup.credential.tsx`) just tell the user to click the
link; there is no in-app way to complete confirmation without email access on
the same/a link-clickable device.

`supabase/config.toml` already sets `otp_length = 6` under `[auth.email]`, so
the underlying OTP Supabase generates per confirmation is already a 6-digit
code (`{{ .Token }}` in email templates) — it's just not surfaced anywhere
today; the link encodes a hashed form of it instead.

## Decision: code only, no link

The confirmation email will show **only** the 6-digit code — no clickable
link. The user types the code into a form on the existing "check your email"
screen. One verification path to build, test, and reason about, matching the
todo's wording exactly.

`/auth/confirm` (the link-based route) is **left in place, unchanged**. It
costs nothing to keep and means any confirmation email already sent before
this ships (with the old link template) still resolves correctly instead of
404ing after deploy. No other Supabase Auth flow in this codebase sends a
user-facing link through it today (grepped: the only other `verifyOtp`
caller is the passkey→session bridge in `server/passkeys.ts:271`, which is a
server-side `magiclink` token immediately redeemed in the same request —
never emailed, never touches `/auth/confirm`).

## Architecture

1. **Email template.** New `supabase/templates/confirmation.html` renders
   `{{ .Token }}` prominently (large, monospace, no link). New
   `[auth.email.template.confirmation]` block in `supabase/config.toml` points
   `content_path` at it and sets the subject line.
   - **Deployment note:** `config.toml` only governs the local Supabase stack.
     The hosted Supabase Cloud project's "Confirm signup" template must be
     updated separately (paste the same HTML into the Auth → Email Templates
     dashboard, or `supabase config push` if/when that becomes the adopted
     workflow). Document this as a manual post-deploy step in
     `docs/deploy_fly.md`, next to the existing Resend/SMTP setup notes.
2. **Server fn.** New `confirmSignupCode(email, token)` in
   `frontend/src/server/passkeys.ts` (alongside the existing
   `passwordSignup`/`setSignupPassword` signup-flow functions — same module,
   same audience). Calls:
   ```ts
   const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
   ```
   using the existing request-cookie `getSupabaseServerClient()` (no
   service_role — matches every other server fn in this codebase). Returns
   `{ ok: true }` on success; on failure returns `{ ok: false, message }` with
   a friendly message ("That code is invalid or has expired — check the
   digits, or resend the email.").
   A thin `createServerFn({ method: "POST" })` wrapper goes in
   `frontend/src/lib/authServerFns.ts` next to `signupWithPassword`, following
   that file's existing lazy-import-and-delegate pattern.
3. **UI component.** New `frontend/src/components/auth/EmailCodeConfirm.tsx`,
   replacing the duplicated static "check your email" JSX currently inline in
   both `signup.password.tsx` (lines 77-121) and the equivalent block in
   `signup.credential.tsx`. Props: `email: string`, `onVerified: () => void`.
   Renders:
   - Heading/lede ("Enter the code we sent to `<email>`").
   - A single 6-digit code `<input>` — `inputMode="numeric"`,
     `autoComplete="one-time-code"`, `maxLength={6}`, strips non-digit
     characters on change/paste (so pasting "123 456" or "123-456" still
     works).
   - Submit button, calling the new server fn; on success calls `onVerified()`
     (the two call sites navigate to `/onboarding`, matching current
     behavior).
   - Error state (`role="alert"`, same `.auth-error` class as the password
     form).
   - Resend, reusing the existing `useResendVerification` hook verbatim (no
     changes needed there — `supabase.auth.resend({ type: "signup", email })`
     re-triggers the same new template).
   - "Already confirmed? Sign in" footer, same as today.
4. **Call sites.** `signup.password.tsx` and `signup.credential.tsx` swap
   their static pending-email block for `<EmailCodeConfirm email={pendingEmail} onVerified={() => router.navigate({ to: "/onboarding" })} />`.

## Testing

- **Unit tests** (vitest, mocked Supabase client — same precedent as
  `frontend/src/server/feedbackStats.test.ts`): `confirmSignupCode` calls
  `verifyOtp` with `{ email, token, type: "signup" }`; maps a Supabase error
  to `{ ok: false, message }`; maps success to `{ ok: true }`.
- **Unit test** for the digit-sanitizing input logic (paste "123-456" → "123456",
  reject non-digits, cap at 6 chars) — pure function, extracted from the
  component so it's directly testable.
- **No e2e change.** Explicitly decided: local `supabase/config.toml` keeps
  `enable_confirmations = false`, so existing e2e specs
  (`signup-flow.spec.ts`, `passkey-flow.spec.ts`) are untouched and keep
  passing exactly as today (immediate session, no confirmation screen shown
  locally). The new code-entry screen therefore has no automated e2e coverage
  in this pass — it's exercised manually against a config with confirmations
  enabled (or in production) before shipping. This is a deliberate scope
  tradeoff, not an oversight: flipping local confirmations on would require
  reworking two existing passing e2e specs to fetch OTPs via the admin
  client, which was declined as out of scope for this change.

## Out of scope

- Changing `/auth/confirm` or any other `verifyOtp` call site.
- Any change to `enable_confirmations`, rate limits, or `otp_expiry`.
- Password reset / email change / magic-link sign-in flows (none currently
  exist in this codebase's user-facing routes).
- Automated e2e coverage of the new screen (see Testing above).
