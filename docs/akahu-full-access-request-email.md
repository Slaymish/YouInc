# Akahu Full API Access Request — Email Draft

Draft email requesting an upgrade from a Personal/dev app to full API access
with multi-user OAuth. Send to **hello@akahu.nz**.

Attach the square logo: `brand/logos/png/youinc-icon-512.png`.

---

**To:** hello@akahu.nz
**Subject:** Full API access request — YouInc (multi-user OAuth, dev environment)

Kia ora Akahu team,

I'm building **YouInc**, a multi-tenant personal finance dashboard — a
self-service executive dashboard over a per-user double-entry ledger. Each user
signs up, gets their own isolated workspace, and connects their own bank via
Akahu so their transactions sync live into their ledger (net worth, cashflow,
runway, balance sheet, etc.).

I've built the OAuth2 authorization-code flow against your docs and would like to
upgrade my dev app to full API access so I can onboard multiple users via OAuth
(enduring consent, accounts, and transactions). Details for my dev environment:

- **Legal name:** Hamish Burke (sole operator, personal project)
- **NZBN:** N/A (not currently a registered entity)
- **App name:** YouInc
- **App logo:** attached (square, 512×512 PNG)
- **Redirect URI(s):**
  - `https://youinc.net/api/akahu/callback` (production)
  - `http://localhost:3000/api/akahu/callback` (local development)
- **Webhook URL:** not required at this stage — I'm currently using on-demand
  sync with scheduled polling as the fallback you recommend. Happy to register an
  HTTPS webhook endpoint later when I move to push-based background sync.

The scopes I intend to request are `ENDURING_CONSENT ACCOUNTS TRANSACTIONS`.

Ngā mihi, and let me know if you need anything else.

Ngā mihi,
Hamish Burke

---

## Requirements check (verified against Akahu docs, 2026-07-07)

Sources:
- https://developers.akahu.nz/docs/authorizing-with-oauth2
- https://developers.akahu.nz/docs/reference-webhooks

| Requirement | Status |
| --- | --- |
| At least one Redirect URI supplied at registration | ✅ prod + local provided |
| App ID Token + App Secret (issued by Akahu on registration) | ✅ wired as `AKAHU_APP_TOKEN` / `AKAHU_APP_SECRET` |
| OAuth2 authorization-code flow (redirect → code → server-side token exchange) | ✅ implemented in `frontend/src/server/akahuOAuth.ts` |
| Token exchange sends `grant_type`, `code`, `redirect_uri`, `client_secret` | ✅ matches `exchangeAuthorizationCode` |
| Scopes | ✅ `ENDURING_CONSENT ACCOUNTS TRANSACTIONS` |
| Webhooks (optional; not available for Personal Apps) | ⏭️ deferred — on-demand sync + polling is an Akahu-endorsed fallback |

### Notes / things to confirm before sending
- **Legal name / NZBN:** listed as personal (Hamish Burke) with N/A NZBN — no
  registered entity found in the repo. Update if you've since incorporated.
- **Webhooks:** must be a valid HTTPS URI returning HTTP 200 within 5s, and are
  configured by emailing Akahu (not self-serve). No webhook route exists in the
  codebase yet, so it's deferred. If/when added, subscribe per-user right after
  the OAuth token exchange and verify the `X-Akahu-Signature` header (the `akahu`
  npm SDK's `webhooks.validateWebhook` handles this).
