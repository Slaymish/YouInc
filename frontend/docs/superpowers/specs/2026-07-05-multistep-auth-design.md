# Multi-step signin/signup with passkeys — design

## Why

The current `/signin` and `/signup` are single-page forms (all fields shown at once,
no separate steps). This redesigns them as multi-step, single-field-per-screen flows
modeled on Google's account sign-in/sign-up UX: one thing at a time, a step-scoped URL
that survives refresh/back-button, and real WebAuthn passkeys with conditional-UI
autofill.

**Correction to existing docs:** `frontend/CLAUDE.md` describes a passkey/WebAuthn
system (`src/server/auth.ts`, `/login`, single-owner `/dashboard` gate). That system
was already removed — `src/start.ts` line 5 says so explicitly, there is no
`@simplewebauthn` dependency, and no `auth.ts`/`login.tsx` file exists. This spec
builds WebAuthn passkey support **from scratch**, scoped to Supabase multi-tenant
accounts, not by reviving the old code. `frontend/CLAUDE.md` and `.env.example` should
be updated once this ships (out of scope for this spec, noted here so it isn't lost).

## Out of scope

- Locale switcher (no i18n infra exists; not worth building for this pass).
- Full app translation.
- Account-settings UI for managing/adding passkeys after signup (future spec — the
  `passkey_credentials` table and its RLS are designed to support it later without
  migration).

## Architecture

### 1. Flow tokens (`auth_flows` table)

A short-lived, pre-auth "continuation token," mirroring what Google's URLs are doing
under the hood:

```sql
create table auth_flows (
  token uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('signup', 'signin')),
  email text,
  first_name text,
  last_name text,
  step text not null,
  has_passkey boolean,           -- signin only: does this email have a credential?
  user_id uuid,                  -- filled once the Supabase account exists (signup)
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes'
);
alter table auth_flows enable row level security;
-- No policies: deny-all direct access. All reads/writes go through the
-- SECURITY DEFINER RPCs below, matching the akahu_connections secret pattern.
```

RPCs (all `SECURITY DEFINER`):

- `start_auth_flow(kind, email) returns token` — creates the row, returns the token.
- `get_auth_flow(token) returns row` — returns null if missing/expired (expired rows
  are simply excluded, not deleted synchronously; a periodic cleanup can be added
  later without changing the API).
- `update_auth_flow(token, patch fields...)` — validates the step transition server
  side (can't jump ahead), updates fields.

Each step route's `loader` calls `get_auth_flow`; if it's null (expired, wrong step,
bad token), redirect to the flow's step-1 route with a "that link expired, let's
start again" notice — never a hard error.

### 2. Routes (flat-file convention, matching `auth.confirm.tsx`)

```
signup.tsx            → step 1: email
signup.name.tsx        → step 2: first/last name (optional)
signup.credential.tsx  → step 3: "Create a passkey" / "Use a password instead"
signup.password.tsx    → step 3b: password (only reached via the "instead" link,
                          or as a fallback if passkey registration fails/cancels)

signin.tsx             → step 1: email
signin.password.tsx    → step 2: password, or "Continue with passkey" if has_passkey
```

Each step page reads `?flow=<token>` from search params, loads the flow row in its
`loader`, and 404s→redirects-to-step-1 if invalid.

### 3. Signup — passkey-first credential step

`signup.credential.tsx` shows:

- Primary: **"Create a passkey"**
- Secondary: **"Use a password instead"** → `signup.password.tsx`

**Create a passkey branch:**

1. Server calls `supabase.auth.signUp({ email, password: <server-generated random,
   discarded immediately> })`.
   - **Dev** (`enable_confirmations = false`): returns a live session.
   - **Prod** (confirmations on): returns a user, no session.
2. Either way we have `data.user.id`. Generate WebAuthn registration options keyed to
   that id (`@simplewebauthn/server`), run the browser ceremony
   (`@simplewebauthn/browser`), verify the response server-side.
3. Insert the verified credential into `passkey_credentials` **using the
   service-role client** — this is what makes registration work identically in both
   dev and prod, since prod has no session yet at this point.
4. Prod: show the existing "check your email" interstitial. Dev: go straight to
   `/onboarding`.
5. If the ceremony fails or the user cancels (no platform authenticator, etc.): fall
   back in place to a plain password field on the same screen. The account already
   exists at this point, so this becomes "set your password" (an update), not a new
   `signUp`.

**Use a password instead branch:** ordinary `signUp` with a user-chosen password, no
passkey row. The existing honeypot field moves to this step (bots are more likely to
complete a full form than abandon at a passkey prompt).

`passkey_credentials`:

```sql
create table passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key bytea not null,
  counter bigint not null default 0,
  transports text[],
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table passkey_credentials enable row level security;
create policy "read own credentials" on passkey_credentials
  for select using (user_id = auth.uid());
create policy "delete own credentials" on passkey_credentials
  for delete using (user_id = auth.uid());
-- No insert/update policy for authenticated/anon: writes only via service-role
-- (registration) or SECURITY DEFINER RPCs (counter bump on successful signin).
```

### 4. Signin — passkey + password, and the session-minting bridge

**Step 1 (email):** input has `autoComplete="username webauthn"`; on mount, fire a
passive conditional-mediation WebAuthn request
(`navigator.credentials.get({ mediation: "conditional", publicKey: {...} })`) — this
is the 1Password-popover behavior from the Google page. If the user picks a saved
passkey before typing/submitting, verify immediately (same verification path as step
2) and skip straight to a session — no separate step needed for that case.

Otherwise: submit email → `passkey_exists_for_email(email)` (`SECURITY DEFINER` RPC)
→ stored on the flow row → advance to `password`.

**Step 2:** if `has_passkey`, primary button **"Continue with passkey"** (an explicit
click, since a full non-conditional `navigator.credentials.get()` prompt wants a user
gesture) plus **"Use password instead"**. If no passkey, just the password field
(today's `signInWithPassword`, unchanged).

**Turning a verified assertion into a Supabase session** (no direct API for this in
Supabase, so bridging through a supported primitive rather than hand-signing
GoTrue-compatible JWTs):

1. Look up the credential by `credential_id` via `find_passkey_credential`
   (`SECURITY DEFINER` RPC — needed since there's no session yet to scope an RLS
   read). Verify signature + counter with `@simplewebauthn/server`.
2. On success, `bump_passkey_credential(credential_id, new_counter)`
   (`SECURITY DEFINER` RPC) updates `counter` and `last_used_at` — same
   no-session-yet reasoning as the lookup.
3. Service-role client: `auth.admin.generateLink({ type: "magiclink", email })` →
   `hashed_token`.
4. Request-cookie SSR client (the one already wired to write session cookies via
   `setAll` in `supabaseServer.ts`): `auth.verifyOtp({ token_hash, type: "magiclink" })`
   → mints a real session, cookies written by existing plumbing.

New secret required: `SUPABASE_SERVICE_ROLE_KEY` (server-only, never in the client
bundle — used for the two service-role operations above and the passkey-credential
insert during registration).

### 5. Chrome

- `AuthShell` gets a footer: links to the existing `/help`, `/privacy`, `/terms`
  routes (all already exist) plus a copyright line.
- Per-step content is trimmed to match Google's minimalism: a step indicator (reusing
  the `onb-steps` dot pattern from `onboarding.tsx`), one h1, one field or choice, one
  primary action. The current marketing-style copy is dropped from the step screens
  (it fights single-field minimalism); if kept anywhere, only on `signup` step 1.
- No locale switcher (per earlier decision — no i18n infra exists).

### 6. New config

- `PASSKEY_RP_ID` / `PASSKEY_RP_ORIGIN` — server-only, derived from the request by
  default (same approach the old removed system used), overridable for proxied
  deployments.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, new.
- New deps: `@simplewebauthn/server`, `@simplewebauthn/browser`.

## Testing

- **Playwright** (golden paths, per web testing rules): signup via passkey in dev
  (no email confirmation), signup via password, signin via passkey, signin via
  password, flow-token expiry redirecting back to step 1. Standard breakpoints.
- **Vitest**: flow-token RPC input validation; WebAuthn verification helpers in
  isolation (mock `@simplewebauthn/server`).
- **Accessibility**: keyboard navigation between steps, focus management on step
  transitions, on the new single-field screens.

## Known edge cases

- Prod passkey signup still shows "check your email" (Supabase confirmation gates the
  account regardless of credential type) — the passkey is already registered by the
  time that screen shows; the confirm link is only about activating the account, not
  about the passkey.
- Email enumeration: `passkey_exists_for_email` necessarily reveals *something* about
  account existence (same category of disclosure Supabase's own signup errors already
  have). Not fully eliminable without disproportionate complexity; noted, not solved.
