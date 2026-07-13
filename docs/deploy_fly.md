# Deploying YouInc (Fly.io + Supabase Cloud)

The app is **stateless**: all persistence is a Supabase Cloud project (Postgres
+ Auth + RLS + Vault). Fly.io runs a single scale-to-zero Machine serving the
built Nitro server — **no volume, no local SQLite**. A Machine restart loses
nothing.

## What gets deployed

One Docker image (`Dockerfile`) containing the built TanStack Start frontend
(`frontend/.output`). Because Supabase's URL + anon key are inlined by Vite at
**build time**, they are passed as **Docker build-args** (in `fly.toml`
`[build.args]`), not runtime secrets — a Fly secret would arrive too late for
the build. Both are public-safe (the anon key is gated by Row-Level Security).

`fly.toml` sets `min_machines_running = 0` with `auto_stop_machines = "stop"` /
`auto_start_machines = true` — the Machine suspends when idle and Fly Proxy
starts it on the next request. `internal_port = 3000` matches the server's port.

## One-time setup

### 1. Supabase Cloud

```sh
supabase login
# Create a project in the dashboard (region: Southeast Asia / Sydney), then:
supabase link --project-ref <your-project-ref>
supabase db push        # applies every migration in supabase/migrations/
```

Verify RLS is actually enforced against the cloud project (each test wraps in a
rolled-back transaction):

```sh
for f in supabase/tests/*.sql; do psql "$CLOUD_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

In the dashboard → **Authentication**:

- **URL Configuration:** Site URL = `https://youinc.hamishburke.dev`; add
  `https://youinc.hamishburke.dev/**` to Redirect URLs.
- **Email → Confirm email:** ON.
- **Email Templates → Confirm signup:** paste the contents of
  `supabase/templates/confirmation.html` (the local stack picks this up
  automatically via `[auth.email.template.confirmation]` in
  `supabase/config.toml`; the hosted dashboard template is separate and needs
  this manual paste after any edit to that file). It shows only the 6-digit
  `{{ .Token }}` code — no link — which the user types into the confirm
  screen (`src/components/auth/EmailCodeConfirm.tsx`, calling
  `supabase.auth.verifyOtp({ email, token, type: "signup" })`).

Record the project's **URL**, **anon/public key**, and **service_role key** from
Project Settings → API. The service_role key is now required (passkey
registration and the passkey→session bridge run pre-session and must bypass
RLS — see `src/server/supabaseAdmin.ts`); it is a runtime secret, never a
build-arg or `VITE_`-prefixed var.

### 2. Email (Resend custom SMTP)

- Create a Resend account, add `hamishburke.dev`, and add the SPF/DKIM DNS
  records Resend lists (additive; does not affect existing mail).
- Create a Resend API key.
- Supabase → **Authentication → SMTP Settings → Enable Custom SMTP:** host
  `smtp.resend.com`, port `465`, username `resend`, password = the API key,
  sender `no-reply@youinc.hamishburke.dev`.

### 3. Fly build-args + app

Put the Supabase URL + anon key into `fly.toml` `[build.args]`
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), then:

```sh
fly launch --no-deploy --copy-config --name youinc --region syd   # first time only
fly secrets set SUPABASE_SERVICE_ROLE_KEY='<service_role_key>'    # required — passkey auth
fly secrets set \
  AKAHU_APP_TOKEN='<app_token>' \
  AKAHU_SECRET='<app_secret>' \
  AKAHU_OAUTH_REDIRECT_URI='https://youinc.hamishburke.dev/api/akahu/callback'
# optional: fly secrets set YOUINC_LEADS_WEBHOOK_URL='...' YOUINC_FEEDBACK_WEBHOOK_URL='...'
```

Do **not** create a volume. If a previous deploy left one, remove it:
`fly volumes list` then `fly volumes destroy <id>`.

## Deploy

```sh
fly deploy
```

Then confirm the deployed bundle points at the **cloud** Supabase (not
`127.0.0.1:54321`): fetch a built JS asset from the live URL and grep for your
`*.supabase.co` host. This guards the build-arg wiring.

### Custom domain

```sh
fly certs add youinc.hamishburke.dev
```

Add the CNAME (and/or A/AAAA) target Fly prints to `hamishburke.dev` DNS, then
`fly certs check youinc.hamishburke.dev` until the certificate is issued.

## Continuous deployment (GitHub Actions)

`.github/workflows/ci.yml` builds + tests on every push/PR and, on push to
`main` after tests pass, runs `flyctl deploy --remote-only` (build-args come from
`fly.toml`, so the remote builder picks them up). One-time:

```sh
fly tokens create deploy -x 999999h
```

Add the full output (including the `FlyV1 ` prefix) as the `FLY_API_TOKEN`
GitHub Actions secret. Do this **last**, after the first manual deploy is
verified, so a push to `main` doesn't auto-deploy before prod is ready.

## Day-to-day operations

- **Logs:** `fly logs`
- **Restart:** `fly apps restart youinc` (nothing is lost — state is in Supabase)
- **Manually wake:** just hit the URL (`auto_start_machines` handles it)
- **Force-stop to save cost:** `fly scale count 0` (`fly scale count 1` to restore)

Backups are Supabase's responsibility (Project Settings → Database → Backups);
there is no volume to snapshot.
