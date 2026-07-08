-- =============================================================================
-- YouInc — grant service_role INSERT on passkey_credentials  |  bugfix
-- =============================================================================
-- Root cause of "passkey creation succeeds client-side, then falls back to
-- 'set a password'": migration 20260705160000 created passkey_credentials and
-- granted `select, delete` to `authenticated`, but never granted anything to
-- `service_role`. service_role's BYPASSRLS attribute skips the RLS policies,
-- but it still needs an ordinary table GRANT to touch the table at all — and
-- with none, it inherited only the owner's default `Dxtm` (no SELECT/INSERT/
-- UPDATE/DELETE). `finishPasskeyRegistration` (server/passkeys.ts) inserts the
-- verified credential via the service-role client, which failed with
-- "permission denied for table passkey_credentials" on every registration.
-- =============================================================================

grant insert on public.passkey_credentials to service_role;
