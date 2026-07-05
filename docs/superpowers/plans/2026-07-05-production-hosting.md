# YouInc Production Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship YouInc as a fully stateless, multi-tenant app hosted at `youinc.hamishburke.dev` on Fly.io, backed by a Supabase Cloud project, with working self-service signup (confirmation email), live Akahu sync, and CI auto-deploy.

**Architecture:** Supabase Cloud (Postgres + Auth + RLS + Vault) is the single source of truth. Fly.io runs one scale-to-zero Nitro Machine with **no volume** — `leads`/`feedback` move into Supabase via anon-callable `SECURITY DEFINER` RPCs, the dormant passkey/SQLite path is removed, and `better-sqlite3` is dropped entirely.

**Tech Stack:** TanStack Start (React 19 + Nitro), `@supabase/ssr` + `@supabase/supabase-js`, Supabase (Postgres/Auth/Vault), Fly.io (Docker), Resend (SMTP), GitHub Actions.

## Global Constraints

- Region for both Supabase and Fly: `syd`.
- Public domain: `youinc.hamishburke.dev`; sender: `no-reply@youinc.hamishburke.dev`.
- Supabase URL + anon key reach the app as **Docker build-args** (Vite inlines them at build), NOT Fly runtime secrets. Both are public-safe (RLS-gated).
- No `service_role` key anywhere in app code or the client bundle.
- After this plan, prod holds **no local disk state**: no Fly volume, no SQLite, no `better-sqlite3` dependency.
- Node 22, pnpm 10.33.0. Commands run from `frontend/` unless stated. `pnpm build` runs `vite build && tsc --noEmit` — it must stay green (type errors fail the build).
- Prod starts with **clean data** — no SQLite→Supabase migration.
- Supabase local project id is `YouInc`; the local DB container is `supabase_db_YouInc`.

---

## PART A — Repo: stateless refactor (local; mergeable before any cloud spend)

### Task 1: Migration — `feedback` table + `record_lead`/`record_feedback` RPCs

**Files:**
- Create: `supabase/migrations/20260705120000_leads_feedback_rpcs.sql`
- Create: `supabase/tests/leads_feedback.sql`

**Interfaces:**
- Produces (SQL, callable by `anon` + `authenticated`):
  - `public.record_lead(p_email text, p_name text, p_interest text, p_source text, p_user_agent text) returns void`
  - `public.record_feedback(p_vote text, p_note text, p_variant text, p_source text, p_path text) returns void`
  - `public.feedback` table.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260705120000_leads_feedback_rpcs.sql`:

```sql
-- =============================================================================
-- YouInc — Leads + Feedback via anon-callable SECURITY DEFINER RPCs
-- =============================================================================
-- Makes the app stateless: public marketing writes (waitlist leads, A/B feedback
-- votes) go to Postgres instead of local SQLite. Writes funnel through definer
-- RPCs owned by postgres so the anon role needs NO direct table privilege and
-- the tables are never client-readable. Mirrors the Akahu token RPC pattern
-- (migration 20260704120006). Verified by supabase/tests/leads_feedback.sql.
-- =============================================================================

-- feedback: A/B votes from public marketing pages (unauthenticated).
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  vote       text not null check (vote in ('up', 'down')),
  note       text,
  variant    text not null check (variant in ('A', 'B')),
  source     text not null,
  path       text not null,
  created_at timestamptz not null default now()
);
-- RLS on, NO policies: only the SECURITY DEFINER RPC (owned by postgres) writes;
-- nothing can be read/written by anon or authenticated directly.
alter table public.feedback enable row level security;

-- record_lead: upsert a waitlist/concierge lead by (lower-cased) email.
create or replace function public.record_lead(
  p_email      text,
  p_name       text,
  p_interest   text,
  p_source     text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.leads (email, name, interest, source, user_agent)
  values (lower(btrim(p_email)), p_name, p_interest, p_source, p_user_agent)
  on conflict (email) do update set
    name       = excluded.name,
    interest   = excluded.interest,
    source     = excluded.source,
    user_agent = excluded.user_agent;
end;
$$;

-- record_feedback: insert one feedback vote.
create or replace function public.record_feedback(
  p_vote    text,
  p_note    text,
  p_variant text,
  p_source  text,
  p_path    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.feedback (vote, note, variant, source, path)
  values (p_vote, p_note, p_variant, p_source, p_path);
end;
$$;

-- Force all lead writes through record_lead: drop the direct anon INSERT path
-- added in the schema migration.
drop policy if exists leads_anon_insert on public.leads;
revoke insert on public.leads from anon;

-- Grant EXECUTE on the RPCs (public marketing pages call them unauthenticated).
revoke execute on function public.record_lead(text, text, text, text, text)     from public;
revoke execute on function public.record_feedback(text, text, text, text, text) from public;
grant  execute on function public.record_lead(text, text, text, text, text)     to anon, authenticated;
grant  execute on function public.record_feedback(text, text, text, text, text) to anon, authenticated;
```

- [ ] **Step 2: Write the SQL verification test**

Create `supabase/tests/leads_feedback.sql`:

```sql
-- =============================================================================
-- YouInc — Leads/Feedback RPC test
-- Run: docker exec -i supabase_db_YouInc \
--   psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/leads_feedback.sql
-- Wrapped in a rolled-back transaction — re-runnable, leaves no residue.
-- =============================================================================
begin;

-- ── record_lead upserts + dedupes by email (as the anon role) ────────────────
set local role anon;
do $$
begin
  perform public.record_lead('dup@b.com', null, 'self-serve', 'hero', 'ua1');
  perform public.record_lead('dup@b.com', null, 'concierge', 'pricing', 'ua2');
end $$;
set local role postgres;
do $$
declare n int; src text;
begin
  select count(*), max(source) into n, src from public.leads where email = 'dup@b.com';
  assert n = 1, 'record_lead must upsert, not duplicate';
  assert src = 'pricing', 'record_lead must update on conflict';
  raise notice 'PASS: record_lead upserts by email';
end $$;

-- ── record_feedback inserts (as the anon role) ───────────────────────────────
set local role anon;
select public.record_feedback('up', 'nice', 'A', 'landing', '/');
set local role postgres;
do $$
declare n int;
begin
  select count(*) into n from public.feedback where source = 'landing';
  assert n = 1, 'record_feedback must insert a row';
  raise notice 'PASS: record_feedback inserts';
end $$;

-- ── anon can call the RPCs but CANNOT read the tables directly ────────────────
set local role anon;
do $$
begin
  begin
    perform 1 from public.leads limit 1;
    raise exception 'anon must NOT be able to SELECT leads';
  exception when insufficient_privilege then
    raise notice 'PASS: anon cannot SELECT leads';
  end;
  begin
    perform 1 from public.feedback limit 1;
    raise exception 'anon must NOT be able to SELECT feedback';
  exception when insufficient_privilege then
    raise notice 'PASS: anon cannot SELECT feedback';
  end;
end $$;

rollback;
```

- [ ] **Step 3: Reset the local DB so the new migration applies**

Run: `supabase db reset`
Expected: all migrations apply cleanly, ending with `20260705120000_leads_feedback_rpcs`.

- [ ] **Step 4: Run the SQL test — expect PASS notices**

Run (from repo root):
```bash
docker exec -i supabase_db_YouInc psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/leads_feedback.sql
```
Expected: `PASS:` notices for upsert, insert, and both anon-SELECT denials; final `ROLLBACK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260705120000_leads_feedback_rpcs.sql supabase/tests/leads_feedback.sql
git commit -m "feat: leads/feedback Supabase RPCs (stateless writes)"
```

---

### Task 2: Rewrite `leads.ts` onto the Supabase RPC

**Files:**
- Modify (rewrite): `frontend/src/server/leads.ts`
- Rewrite: `frontend/src/server/leads.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient()` from `./supabaseServer`; `throwServerError(message, status)` from `./serverError`; `public.record_lead` RPC (Task 1).
- Produces: `validateLead(input): { lead: WaitlistInput } | { skip: true }` (pure); `recordLead(input): Promise<{ ok: true }>`.

- [ ] **Step 1: Rewrite the unit test (pure validation + honeypot)**

Replace `frontend/src/server/leads.test.ts` entirely:

```ts
import { describe, expect, it } from "vitest";
import { validateLead } from "./leads";

describe("validateLead", () => {
  it("parses and lower-cases a valid signup", () => {
    const result = validateLead({ email: "Jane@Example.com", source: "hero" });
    expect(result).toEqual({ lead: expect.objectContaining({ email: "jane@example.com", source: "hero" }) });
  });

  it("returns skip for a filled honeypot (no persistence)", () => {
    expect(validateLead({ email: "bot@b.com", company: "Acme Spam" })).toEqual({ skip: true });
  });

  it("throws a catchable 400 ServerFnError on invalid email", () => {
    try {
      validateLead({ email: "not-an-email" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).name).toBe("ServerFnError");
      expect((err as Error & { status: number }).status).toBe(400);
    }
  });

  it("throws 400 when the honeypot exceeds 200 chars", () => {
    try {
      validateLead({ email: "bot@b.com", company: "x".repeat(201) });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as Error & { status: number }).status).toBe(400);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/server/leads.test.ts`
Expected: FAIL — `validateLead` is not exported yet.

- [ ] **Step 3: Rewrite `leads.ts`**

Replace `frontend/src/server/leads.ts` entirely:

```ts
// Server-only lead capture. Writes go to Supabase via the record_lead
// SECURITY DEFINER RPC (see supabase/migrations/20260705120000). No local disk.
import { z } from "zod";
import { getSupabaseServerClient } from "./supabaseServer";
import { throwServerError } from "./serverError";

const WaitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().max(120).optional(),
  interest: z.enum(["self-serve", "concierge"]).optional(),
  source: z.string().max(60).optional(),
  userAgent: z.string().max(400).optional(),
  // Honeypot: real users never fill this. Bots do.
  company: z.string().max(200).optional(),
});

export type WaitlistInput = z.infer<typeof WaitlistSchema>;

/**
 * Pure: validate the payload and decide honeypot handling. Throws a 400
 * ServerFnError on invalid input; returns { skip: true } for a filled honeypot
 * (caller pretends success, stores nothing); otherwise the parsed lead.
 */
export function validateLead(input: unknown): { lead: WaitlistInput } | { skip: true } {
  const parsed = WaitlistSchema.safeParse(input);
  if (!parsed.success) {
    throwServerError("Please enter a valid email address.", 400);
  }
  const lead = parsed.data;
  if (lead.company && lead.company.trim().length > 0) {
    return { skip: true };
  }
  return { lead };
}

function notify(lead: WaitlistInput): void {
  const url = process.env.YOUINC_LEADS_WEBHOOK_URL;
  console.info(`[waitlist] new signup: ${lead.email} (${lead.source ?? "unknown"})`);
  if (!url) return;
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: lead.email, source: lead.source, interest: lead.interest }),
  }).catch((err) => console.error("[waitlist] webhook failed", err));
}

export async function recordLead(input: unknown): Promise<{ ok: true }> {
  const result = validateLead(input);
  if ("skip" in result) return { ok: true };
  const { lead } = result;

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("record_lead", {
    p_email: lead.email,
    p_name: lead.name ?? null,
    p_interest: lead.interest ?? null,
    p_source: lead.source ?? null,
    p_user_agent: lead.userAgent ?? null,
  });
  if (error) {
    console.error("[waitlist] record_lead failed", error);
    throwServerError("Could not record your details. Please try again.", 500);
  }
  notify(lead);
  return { ok: true };
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `pnpm vitest run src/server/leads.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify the server-fn caller still type-checks**

`src/components/marketing/WaitlistForm.tsx` does `return recordLead(data)` inside an async `createServerFn` handler — a `Promise<{ok:true}>` return is valid there. Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/server/leads.ts src/server/leads.test.ts
git commit -m "refactor: leads.ts writes via Supabase RPC, drop SQLite"
```

---

### Task 3: Rewrite `feedback.ts` onto the Supabase RPC

**Files:**
- Modify (rewrite): `frontend/src/server/feedback.ts`
- Create: `frontend/src/server/feedback.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient()`; `throwServerError`; `public.record_feedback` RPC (Task 1).
- Produces: `validateFeedback(input): FeedbackInput` (pure, throws 400 on bad input); `recordFeedback(input): Promise<{ ok: true }>`.

- [ ] **Step 1: Write the unit test**

Create `frontend/src/server/feedback.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateFeedback } from "./feedback";

describe("validateFeedback", () => {
  it("parses a valid vote", () => {
    expect(validateFeedback({ vote: "up", variant: "A", source: "landing", path: "/" }))
      .toEqual({ vote: "up", variant: "A", source: "landing", path: "/" });
  });

  it("throws a catchable 400 ServerFnError on an invalid vote", () => {
    try {
      validateFeedback({ vote: "sideways", variant: "A", source: "landing", path: "/" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).name).toBe("ServerFnError");
      expect((err as Error & { status: number }).status).toBe(400);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/server/feedback.test.ts`
Expected: FAIL — `validateFeedback` not exported yet.

- [ ] **Step 3: Rewrite `feedback.ts`**

Replace `frontend/src/server/feedback.ts` entirely:

```ts
// Server-only feedback capture. Writes go to Supabase via the record_feedback
// SECURITY DEFINER RPC (see supabase/migrations/20260705120000). No local disk.
import { z } from "zod";
import { getSupabaseServerClient } from "./supabaseServer";
import { throwServerError } from "./serverError";

const FeedbackSchema = z.object({
  vote: z.enum(["up", "down"]),
  note: z.string().trim().max(500).optional(),
  variant: z.enum(["A", "B"]),
  source: z.string().max(60),
  path: z.string().max(300),
});

export type FeedbackInput = z.infer<typeof FeedbackSchema>;

/** Pure: validate the payload; throws a 400 ServerFnError on invalid input. */
export function validateFeedback(input: unknown): FeedbackInput {
  const parsed = FeedbackSchema.safeParse(input);
  if (!parsed.success) {
    throwServerError("Invalid feedback payload.", 400);
  }
  return parsed.data;
}

function notify(feedback: FeedbackInput): void {
  const url = process.env.YOUINC_FEEDBACK_WEBHOOK_URL;
  console.info(`[feedback] ${feedback.vote} vote on ${feedback.path} (variant ${feedback.variant})`);
  if (!url) return;
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(feedback),
  }).catch((err) => console.error("[feedback] webhook failed", err));
}

export async function recordFeedback(input: unknown): Promise<{ ok: true }> {
  const feedback = validateFeedback(input);
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("record_feedback", {
    p_vote: feedback.vote,
    p_note: feedback.note ?? null,
    p_variant: feedback.variant,
    p_source: feedback.source,
    p_path: feedback.path,
  });
  if (error) {
    console.error("[feedback] record_feedback failed", error);
    throwServerError("Could not record feedback.", 500);
  }
  notify(feedback);
  return { ok: true };
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `pnpm vitest run src/server/feedback.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check and commit**

```bash
pnpm exec tsc --noEmit
git add src/server/feedback.ts src/server/feedback.test.ts
git commit -m "refactor: feedback.ts writes via Supabase RPC, drop SQLite"
```

---

### Task 4: Email-confirmation callback route `/auth/confirm`

**Files:**
- Create: `frontend/src/routes/auth.confirm.tsx`
- Create: `frontend/e2e/auth-confirm.spec.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient()` → `supabase.auth.verifyOtp({ token_hash, type })`.
- Produces: route `/auth/confirm?token_hash=...&type=...` that exchanges a confirmation token for a session cookie, then redirects to `/onboarding` (success) or `/signin` (failure). Cross-device-safe (uses `verifyOtp`, not the PKCE code_verifier).

- [ ] **Step 1: Write the failing e2e (bad token → redirect to /signin)**

Create `frontend/e2e/auth-confirm.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("invalid confirmation token redirects to /signin", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=invalid-token&type=email");
  await expect(page).toHaveURL(/\/signin/);
});

test("missing token redirects to /signin", async ({ page }) => {
  await page.goto("/auth/confirm");
  await expect(page).toHaveURL(/\/signin/);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm exec playwright test e2e/auth-confirm.spec.ts`
Expected: FAIL — route 404s (no redirect).

- [ ] **Step 3: Create the route**

Create `frontend/src/routes/auth.confirm.tsx`:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { EmailOtpType } from "@supabase/supabase-js";

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
```

- [ ] **Step 4: Run the e2e — expect PASS**

Run: `pnpm exec playwright test e2e/auth-confirm.spec.ts`
Expected: PASS (both redirect to `/signin`).

Note: the *success* path (valid token → `/onboarding`) can't be exercised locally with confirmation OFF; it is verified in Task 12's prod smoke test.

- [ ] **Step 5: Type-check and commit**

```bash
pnpm exec tsc --noEmit
git add src/routes/auth.confirm.tsx e2e/auth-confirm.spec.ts
git commit -m "feat: /auth/confirm email verification callback"
```

---

### Task 5: Retire the dormant passkey path

**Files:**
- Delete: `frontend/src/server/auth.ts`
- Delete: `frontend/src/routes/login.tsx`
- Modify: `frontend/src/start.ts` (remove the auth import + session gate)

**Interfaces:**
- Produces: `start.ts` exporting `startInstance` with only the CSRF middleware (no `sessionGate`, no `~/server/auth` import).

- [ ] **Step 1: Confirm nothing else imports the passkey path**

Run (from `frontend/`):
```bash
grep -rn "server/auth\|/login\|isValidSession\|ENROLLMENT_TOKEN\|YOUINC_RP_" src | grep -v "supabaseServer\|auth.confirm\|signin\|signup"
```
Expected: only matches inside `start.ts` (and the files being deleted). If any *other* live file appears, stop and reassess.

- [ ] **Step 2: Rewrite `start.ts` without the gate**

Replace `frontend/src/start.ts` entirely:

```ts
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

// Defining a custom start.ts disables Start's automatic CSRF middleware, so it
// must be re-added explicitly to keep server functions protected. The legacy
// passkey session gate was removed with server/auth.ts — Supabase-gated routes
// enforce their own session inside their loaders (see routes/workspace.tsx).
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
```

- [ ] **Step 3: Delete the passkey files**

```bash
git rm src/server/auth.ts src/routes/login.tsx
```

- [ ] **Step 4: Type-check + full test + build**

Run: `pnpm build`
Expected: `vite build` + `tsc --noEmit` succeed with no dangling `~/server/auth` reference.
Run: `pnpm test`
Expected: PASS (no auth.test remains; leads/feedback pure tests pass).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove dormant passkey/WebAuthn path"
```

---

### Task 6: Remove the obsolete SQLite→Supabase importer

**Files:**
- Delete: `frontend/src/server/migration/` (entire directory)

- [ ] **Step 1: Confirm the importer is not referenced by live code**

Run (from `frontend/`):
```bash
grep -rn "server/migration\|migrateSqliteToSupabase" src | grep -v "src/server/migration/"
```
Expected: no matches (only the directory's own files).

- [ ] **Step 2: Delete the directory**

```bash
git rm -r src/server/migration
```

- [ ] **Step 3: Build + test**

Run: `pnpm build && pnpm test`
Expected: both green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove obsolete sqlite→supabase importer (prod starts clean)"
```

---

### Task 7: Delete dead `analytics.ts` DB code and drop `better-sqlite3`

**Files:**
- Modify: `frontend/src/server/analytics.ts` (remove the `better-sqlite3` import + 3 dead `read*(db)` functions)
- Modify: `frontend/package.json` (drop `better-sqlite3`, `@types/better-sqlite3`, and the `onlyBuiltDependencies` entry)

**Interfaces:**
- Consumes: nothing new.
- Produces: `analytics.ts` with only pure `compute*`/`detect*` exports (`computeRecurringPayments`, `detectRecurring`, `computeRecurringGroups`, `computeCategoryMonthly`, `computeDailySpend`, and their types) — the exact set the importers already use.

- [ ] **Step 1: Confirm the `read*(db)` functions are dead**

Run (from `frontend/`):
```bash
grep -rn "readRecurringPayments\|readCategoryMonthly\|readDailySpend" src | grep -v "src/server/analytics.ts"
```
Expected: no matches — all three are unused.

- [ ] **Step 2: Edit `analytics.ts`**

- Remove the top line `import type BetterSqlite3 from "better-sqlite3";` and the `type DB = BetterSqlite3.Database;` alias.
- Delete the three functions `readRecurringPayments(db: DB)`, `readCategoryMonthly(db: DB)`, and `readDailySpend(db: DB)` in their entirety.
- Leave every `compute*`/`detect*` function and all exported types untouched.

- [ ] **Step 3: Remove `better-sqlite3` from `package.json`**

- Delete `"better-sqlite3": "^12.5.0"` from `dependencies`.
- Delete `"@types/better-sqlite3": "^7.6.13"` from `devDependencies`.
- Delete the whole `"pnpm": { "onlyBuiltDependencies": ["better-sqlite3"] }` block.

- [ ] **Step 4: Confirm nothing else imports `better-sqlite3`**

Run (from `frontend/`):
```bash
grep -rn "better-sqlite3" src
```
Expected: no matches.

- [ ] **Step 5: Refresh the lockfile, build, test**

```bash
pnpm install
pnpm build
pnpm test
```
Expected: install updates `pnpm-lock.yaml` (removes better-sqlite3); build + tests green.

- [ ] **Step 6: Commit**

```bash
git add src/server/analytics.ts package.json pnpm-lock.yaml
git commit -m "chore: drop better-sqlite3; remove dead analytics DB readers"
```

---

### Task 8: Docker/Fly build config — build-args, no native toolchain, no volume

**Files:**
- Modify: `Dockerfile`
- Modify: `docker/entrypoint.sh`
- Modify: `fly.toml`

**Interfaces:**
- Produces: an image that (a) needs no native compiler, (b) inlines `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from build-args, (c) starts the server with no volume seeding. `fly.toml` passes the build-args and mounts no volume.

- [ ] **Step 1: Rewrite `Dockerfile`**

Replace `Dockerfile` entirely:

```dockerfile
# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build the TanStack Start frontend (vite build + nitro server).
# No native modules to compile (better-sqlite3 removed), so no python/make/g++.
# VITE_SUPABASE_* are inlined by Vite at build time, so they MUST arrive as
# build-args here (Fly runtime secrets would be too late). Both are public-safe
# (anon key is RLS-gated); baking them into the image is intended.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend-build

RUN npm install -g pnpm@10.33.0

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

# ---------------------------------------------------------------------------
# Stage 2: runtime image. Node runs the built Nitro server. Stateless — no
# volume, no SQLite, all persistence is Supabase over the network.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

COPY --from=frontend-build /app/frontend/.output ./frontend/.output
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
```

- [ ] **Step 2: Simplify `entrypoint.sh` (no volume seeding)**

Replace `docker/entrypoint.sh` entirely:

```bash
#!/usr/bin/env bash
# Fly.io entrypoint: the app is stateless (all persistence is Supabase), so this
# just launches the built Nitro server.
set -euo pipefail

echo "==> Starting frontend on port ${PORT:-3000}"
exec node /app/frontend/.output/server/index.mjs
```

- [ ] **Step 3: Rewrite `fly.toml`**

Replace `fly.toml` entirely (keep the `app` name; it is set at launch in Task 11):

```toml
# Fly.io app configuration for YouInc (stateless).
# See docs/deploy_fly.md for the full walkthrough.

app = "youinc-ledger"          # set to your globally-unique app name at first launch
primary_region = "syd"

[build]
  dockerfile = "Dockerfile"

  # VITE_SUPABASE_* are inlined at build time — they MUST be build-args, not
  # runtime secrets. Both are public-safe (anon key is RLS-gated). Set these to
  # your Supabase Cloud project's values in Task 11 before deploying.
  [build.args]
    VITE_SUPABASE_URL = "https://REPLACE.supabase.co"
    VITE_SUPABASE_ANON_KEY = "REPLACE_WITH_ANON_KEY"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

  [http_service.concurrency]
    type = "requests"
    soft_limit = 200
    hard_limit = 250

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

- [ ] **Step 4: Sanity-check the build locally (optional but recommended)**

If Docker is available, run (from repo root):
```bash
docker build --build-arg VITE_SUPABASE_URL=http://127.0.0.1:54321 --build-arg VITE_SUPABASE_ANON_KEY=test -t youinc-test .
```
Expected: image builds with no python/make/g++ step and no better-sqlite3 compile.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker/entrypoint.sh fly.toml
git commit -m "build: stateless image with Supabase build-args, no volume"
```

---

## PART B — Cloud + hosting (runbook; interactive steps marked `! `)

> Part B provisions live infrastructure and costs money. Do it only after Part A is merged and green. Steps prefixed `! ` are for the **owner** to run in the session prompt (interactive logins/browser actions); the rest the assistant runs and verifies.

### Task 9: Supabase Cloud project + schema + Auth config

**Files:** none (infra + dashboard config).

- [ ] **Step 1 (owner): Authenticate the Supabase CLI**

Run: `! supabase login`
Expected: browser opens; CLI reports logged in.

- [ ] **Step 2 (owner): Create the cloud project**

In the Supabase dashboard: **New project** → name `youinc`, region **Southeast Asia (Sydney) / `ap-southeast-2`**, set a strong DB password (save it). Wait until it is provisioned.

- [ ] **Step 3 (owner): Link the repo to the cloud project**

Run (from repo root): `! supabase link --project-ref <your-project-ref>`
(The project-ref is in the dashboard URL / Project Settings → General.)
Expected: `Finished supabase link`.

- [ ] **Step 4: Push all migrations to cloud**

Run (from repo root): `supabase db push`
Expected: all 8 migrations apply (through `20260705120000_leads_feedback_rpcs`), no errors.

- [ ] **Step 5: Run every SQL isolation/behavior test against CLOUD**

Get the pooler/direct connection string from **Project Settings → Database → Connection string (psql)**, then run each test file (they wrap in a rolled-back transaction, so they leave no residue):
```bash
for f in supabase/tests/*.sql; do
  echo "== $f =="; psql "$CLOUD_DB_URL" -v ON_ERROR_STOP=1 -f "$f";
done
```
Expected: `PASS:` notices from every file (`rls_isolation`, `classification_rules_isolation`, `self_registration`, `akahu_connection`, `akahu_sync_log`, `leads_feedback`); each ends in `ROLLBACK`. Any failure blocks go-live.

- [ ] **Step 6 (owner): Configure Auth URLs + confirmation email template**

In the dashboard → **Authentication**:
- **URL Configuration:** Site URL = `https://youinc.hamishburke.dev`; add `https://youinc.hamishburke.dev/**` to Redirect URLs.
- **Providers → Email:** ensure "Confirm email" is **ON**.
- **Email Templates → Confirm signup:** set the link to the token_hash form the `/auth/confirm` route expects:
  ```html
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirm your email</a>
  ```

- [ ] **Step 7: Capture the project's URL + anon key for the build-args**

From **Project Settings → API**: record the Project URL (`https://<ref>.supabase.co`) and the **anon/public** key. These feed Task 11 Step 1. (Do NOT record the service_role key — it is not used.)

---

### Task 10: Resend SMTP for confirmation email

**Files:** none (external + dashboard config).

- [ ] **Step 1 (owner): Create a Resend account and add the domain**

Run: `! open https://resend.com`
Sign up, then **Domains → Add domain** → `hamishburke.dev`. Resend shows DNS records (SPF/DKIM, typically on a `send.` subdomain).

- [ ] **Step 2 (owner): Add the DNS records**

Add the SPF/DKIM records Resend lists to `hamishburke.dev` DNS. These are additive and do not affect existing mail/MX. Wait for Resend to show the domain **Verified**.

- [ ] **Step 3 (owner): Create a Resend API key**

Resend → **API Keys → Create** (send access). Copy the key.

- [ ] **Step 4 (owner): Point Supabase Auth at Resend SMTP**

Supabase dashboard → **Authentication → Emails / SMTP Settings → Enable Custom SMTP**:
- Host `smtp.resend.com`, Port `465`, Username `resend`, Password = the API key.
- Sender email `no-reply@youinc.hamishburke.dev`, sender name `YouInc`.
Save.

- [ ] **Step 5: Verify a real confirmation email sends**

Deferred to Task 12 Step 4 (needs the deployed domain). Note here that SMTP is configured.

---

### Task 11: Create the Fly app + wire config

**Files:** Modify `fly.toml` (fill the real build-arg values).

- [ ] **Step 1: Put the real Supabase values into `fly.toml [build.args]`**

Replace the two `REPLACE...` placeholders in `fly.toml` with the Project URL and anon key from Task 9 Step 7. Commit:
```bash
git add fly.toml
git commit -m "chore: set Supabase build-args for prod"
```
(The anon key is public-safe, so committing it is acceptable; it is already shipped in the client bundle.)

- [ ] **Step 2 (owner): Authenticate flyctl + ensure billing**

Run: `! fly auth login`
Ensure the Fly account has a payment method (dashboard). Expected: logged in.

- [ ] **Step 3 (owner): Create the app (no deploy, no volume)**

Run (from repo root): `! fly launch --no-deploy --copy-config --name <globally-unique-name> --region syd`
- Accept the existing `fly.toml`. If the name `youinc-ledger` is taken, choose another and update `app =` in `fly.toml`.
- Do **not** create a volume.
Expected: app created; `fly.toml` app name matches.

- [ ] **Step 4: Set runtime secrets**

Run (from repo root):
```bash
fly secrets set AKAHU_APP_TOKEN='<app_token>'
# optional lead/feedback notification webhooks:
# fly secrets set YOUINC_LEADS_WEBHOOK_URL='...' YOUINC_FEEDBACK_WEBHOOK_URL='...'
```
Expected: secrets staged (they apply on next deploy).

---

### Task 12: First deploy, custom domain, end-to-end verification

**Files:** none.

- [ ] **Step 1: Deploy**

Run (from repo root): `fly deploy`
Expected: remote build succeeds (no native compile), image rolls out, health check green.

- [ ] **Step 2: Confirm the bundle points at CLOUD Supabase (not localhost)**

Run:
```bash
curl -s https://<app-name>.fly.dev/ -o /dev/null -w "%{http_code}\n"
# then fetch a built JS asset and confirm the cloud URL is inlined, localhost is not:
curl -s "https://<app-name>.fly.dev/" | grep -o 'assets/[^"]*\.js' | head -1
```
Then fetch that asset and check it contains the cloud `*.supabase.co` URL and does **not** contain `127.0.0.1:54321`. This directly guards the build-arg landmine.

- [ ] **Step 3 (owner): Add the custom domain + DNS**

Run (from repo root): `! fly certs add youinc.hamishburke.dev`
Fly prints a CNAME (and/or A/AAAA) target. Add a `youinc` CNAME in `hamishburke.dev` DNS pointing at the Fly target.
Run: `fly certs check youinc.hamishburke.dev`
Expected: certificate issued; `https://youinc.hamishburke.dev` serves the app over valid TLS.

- [ ] **Step 4: Full funnel smoke test (the success criteria)**

On `https://youinc.hamishburke.dev`, using a real inbox:
- Sign up → see "check your email" → receive the Resend email → click the link → land authenticated on `/onboarding` → complete onboarding → reach `/workspace`.
- Submit a concierge/waitlist form and an A/B feedback vote. Confirm in the Supabase dashboard (Table editor) that `leads` and `feedback` gained rows, and that with the **anon** key those tables are not directly selectable (Task 9 Step 5 already proved this at the DB level).
- Sign up a second user; confirm the two tenants cannot see each other's workspace data.
- Connect a real Akahu user token and run a sync; confirm transactions post to the tenant ledger.
- `fly apps restart <app-name>`; reload — the session/data persist (state is in Supabase; the container carries none).

- [ ] **Step 5: Record verification result**

Note pass/fail of each smoke-test item. Any failure is a blocker; fix before Task 13.

---

### Task 13: Wire CI auto-deploy (last)

**Files:** none (GitHub secret + verify existing workflow).

- [ ] **Step 1: Confirm the workflow is correct as-is**

`.github/workflows/ci.yml` already: builds + tests on PR/push, and deploys via `flyctl deploy --remote-only` on push to `main` gated by `FLY_API_TOKEN`. No Python steps remain. No edit needed — but the remote build must receive the build-args. Since they live in `fly.toml [build.args]`, `flyctl deploy --remote-only` passes them automatically. Confirm by reading the file.

- [ ] **Step 2 (owner): Create a scoped deploy token**

Run (from repo root): `! fly tokens create deploy -x 999999h`
Copy the full output including the leading `FlyV1 ` prefix.

- [ ] **Step 3 (owner): Add the GitHub Actions secret**

Repo → **Settings → Secrets and variables → Actions → New repository secret**: name `FLY_API_TOKEN`, value = the token from Step 2.

- [ ] **Step 4: Verify auto-deploy end to end**

Push a trivial change to `main` (e.g. the docs rewrite in Task 14). Watch **Actions**: the `test-frontend` job passes, then `deploy` runs `flyctl deploy --remote-only` and the change appears on `https://youinc.hamishburke.dev`.

---

### Task 14: Rewrite the docs to match reality

**Files:**
- Modify: `README.md`
- Modify: `docs/deploy_fly.md`

- [ ] **Step 1: Rewrite `docs/deploy_fly.md`**

Replace its content to describe the **stateless** deploy: Supabase Cloud as the datastore; Fly single scale-to-zero Machine with **no volume**; `VITE_SUPABASE_*` as `fly.toml` build-args (not secrets, with the reason); `AKAHU_APP_TOKEN` as the only required runtime secret; custom-domain + `fly certs` steps; Resend custom SMTP; the CI `FLY_API_TOKEN` flow. Remove all SQLite-volume, `fly volumes create`, and Basic Auth content.

- [ ] **Step 2: Update `README.md`**

Remove the "local-first / SQLite ledger", Fly Volume, Basic Auth, and passkey-gating sections. Describe: multi-tenant Supabase app; run locally with `supabase start` + `pnpm dev`; deploy per `docs/deploy_fly.md`; the public marketing routes and the self-service `/signup → /onboarding → /workspace` flow. Keep the Akahu env-var and safety notes that still apply.

- [ ] **Step 3: Build docs-adjacent sanity + commit**

```bash
git add README.md docs/deploy_fly.md
git commit -m "docs: rewrite hosting docs for stateless Supabase + Fly"
```
(This push to `main` doubles as the Task 13 Step 4 auto-deploy verification.)

---

## Self-Review notes

- **Spec coverage:** topology (Tasks 8–12), build-arg fix (Task 8/11/12 Step 2), leads/feedback→Supabase RPC (Tasks 1–3), passkey retirement (Task 5), migration-tool removal (Task 6), better-sqlite3 drop (Task 7), no-volume image (Task 8), Resend SMTP (Task 10), security gates run against cloud (Task 9 Step 5), sequencing with CI last (Task 13), docs rewrite (Task 14), success criteria (Task 12 Step 4). **Added beyond spec:** Task 4 (`/auth/confirm`) — required for the "signup → confirm → onboarding" criterion, which the spec assumed worked but no code handled.
- **Not in this plan (deferred per spec):** scheduled/background Akahu sync; email-summary feature; recovery of the deleted ledger SQLite.
