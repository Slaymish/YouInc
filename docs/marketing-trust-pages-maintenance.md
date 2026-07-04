# YouInc marketing and trust pages maintenance

Last updated: 4 July 2026 (v1.1 copy pass)

## Positioning principle

YouInc should read as a serious founder-led finance product: honest about being early and founder-operated, but mature about privacy, security, data controls, support, and product operations.

Do not pretend YouInc is a large enterprise company. Instead, make the operational surface feel complete, specific, and maintained.

## Pages added in the v1 trust surface

| Page | Route | Purpose | Maintenance owner |
| --- | --- | --- | --- |
| Privacy | `/privacy` | Explains what data is collected, how bank data is used, and how deletion works. | Product/legal |
| Terms | `/terms` | Sets user obligations, billing/custom-work terms, and advice disclaimers. | Product/legal |
| Security | `/security` | Explains bank access, account access, vulnerability reporting, and security roadmap. | Engineering/security |
| Data deletion | `/data-deletion` | Tells users how to export, disconnect, and delete their data. | Product/support |
| Contact | `/contact` | Routes support, security, privacy, billing, and custom-build questions. | Support |
| Docs | `/docs` | Gives users a starting map for setup, concepts, and useful pages. | Product/docs |
| Help | `/help` | Answers common access, sync, export, and support questions. | Support/docs |
| Integrations | `/integrations` | Explains Akahu, supported account types, manual accounts, and custom sources. | Product/engineering |
| Status | `/status` | Shows current service status and incident history. | Engineering/support |
| Changelog | `/changelog` | Proves the product is maintained through dated user-visible updates. | Product |
| Roadmap | `/roadmap` | Sets conservative expectations for what is now, next, and later. | Product |
| About | `/about` | Explains the founder-led story and operating principles. | Product/brand |
| Compare | `/compare` | Helps users place YouInc against budgeting apps, spreadsheets, and accounting tools. | Product/marketing |
| Use cases | `/use-cases` | Gives example use cases without inventing customer claims. | Product/marketing |

## Global maintenance rules

### 1. Update pages when the product reality changes

Trust pages are only useful if they stay true. Update them whenever any of these change:

- Bank connection provider, scope, or supported institutions.
- Authentication method.
- Data storage, retention, backup, or deletion behavior.
- Export formats or export availability.
- Pricing, billing cadence, refund terms, GST/tax handling, or cancellation policy.
- Support contact, response expectations, or escalation paths.
- Security posture, incident response, monitoring, access controls, or third-party review status.
- AI features, especially if financial data is processed by a model or external provider.
- Public availability, waitlist status, onboarding flow, or self-serve access.
- Custom-build process, ownership, pricing, or delivery model.

### 2. Do not overclaim

Avoid claims like:

- “Bank-grade security” unless there is a clear standard being met.
- “Encrypted at rest” unless verified for every relevant store.
- “SOC 2 compliant” unless certified.
- “24/7 support” unless actually staffed.
- “All banks supported” unless accurate.
- “AI never sees your data” unless the implementation guarantees it.

Use precise language instead:

- “Bank connections are read-only through Akahu.”
- “YouInc does not store bank login details.”
- “Support is founder-led during early access.”
- “Self-serve access is currently controlled.”

### 3. Keep founder-led positioning credible

The site should not hide that YouInc is early and founder-led. It should frame that honestly:

- Good: “Founder-led support during early access.”
- Good: “Talk directly with the person building the product.”
- Risky: “Our global support team is available anytime.”
- Risky: fake employee names, fake testimonials, fake company logos, fake usage metrics.

### 4. Separate legal facts from marketing copy

Privacy, terms, security, and data deletion pages must be plain and factual. Do not use launch-page copy, jokes, vague reassurance, or hype on these pages.

If legal counsel reviews the pages, record the review date and do not casually rewrite reviewed clauses without another review.

## Page-specific maintenance guidance

### `/privacy`

Update when:

- New data types are collected.
- Analytics, error tracking, email tooling, payment tooling, or AI vendors are added.
- Data is stored in a new region or database.
- Retention periods change.
- Data is shared with a new third party.

Must eventually include:

- Legal entity name and address if incorporated.
- List of subprocessors or third-party providers.
- Data retention periods by data type.
- Jurisdiction and applicable privacy law details.
- Domain-specific privacy contact.

### `/terms`

Update when:

- Pricing or billing changes.
- Self-serve access opens.
- Refund/cancellation policy changes.
- Concierge or custom-build contract terms change.
- YouInc starts accepting payments publicly.

Must eventually include:

- Legal entity name.
- Governing law.
- Detailed payment, refund, cancellation, and tax terms.
- Liability limitations reviewed by a lawyer.
- Acceptable use terms.
- Service suspension and termination rights.

### `/security`

Update when:

- Authentication changes.
- Encryption, backup, hosting, database, logging, or access-control details change.
- A security review, penetration test, or audit is completed.
- A vulnerability disclosure process is formalized.
- A material incident occurs.

Must eventually include:

- Dedicated `security@...` inbox.
- Vulnerability disclosure policy.
- Non-sensitive system and data-flow overview.
- Access-control process.
- Backup and restore posture.
- Incident response process.
- Security review or penetration test status.

### `/data-deletion`

Update when:

- Export formats change.
- Deletion process changes.
- Self-serve deletion is added.
- Backup retention changes.
- Akahu disconnect flow changes.

Must eventually include:

- Expected response time.
- Exact deletion steps.
- What remains after deletion and why.
- Whether invoices, logs, and backups are retained.
- Self-serve screenshots once available.

### `/contact`

Update when:

- Email addresses change.
- Support hours or response targets change.
- New support channels launch.
- Billing, privacy, or security contacts split into separate inboxes.

Must eventually include:

- `support@...`, `security@...`, `privacy@...`, and `billing@...` addresses.
- Expected response times.
- Escalation instructions for urgent data or security issues.

### `/docs`

Update when:

- Onboarding changes.
- Widgets are added or removed.
- Export behavior changes.
- Bank sync behavior changes.
- Common support questions repeat.

Must eventually include:

- Task-based guides with screenshots.
- “Connect Akahu” walkthrough.
- “Add a manual account” walkthrough.
- “Export your ledger” walkthrough.
- Widget reference pages.
- Troubleshooting articles.

### `/help`

Update when:

- A support question comes up more than twice.
- Users misunderstand bank sync, exports, waitlist access, pricing, or cancellation.
- A known issue needs a public workaround.

Must eventually include:

- Searchable FAQ or structured help center.
- Troubleshooting by topic.
- Links into docs and contact.

### `/integrations`

Update when:

- Akahu support changes.
- Supported institutions change materially.
- New manual account types are added.
- New custom integrations are shipped.
- A third-party integration is added.

Must eventually include:

- Supported institution source of truth.
- Manual account examples.
- Custom integration requirements.
- Known limitations.

### `/status`

Update when:

- Any public incident occurs.
- Bank sync has a material outage.
- Demo is broken.
- Support availability changes.

Must eventually become automated or semi-automated with:

- App uptime checks.
- API checks.
- Database checks.
- Demo route checks.
- Bank sync dependency notes.
- Incident history.

### `/changelog`

Update when:

- User-visible features ship.
- Pricing or access changes.
- Trust/legal/security pages change materially.
- Docs, exports, integrations, or onboarding improve.
- Incidents result in follow-up improvements.

Do not include:

- Internal refactors unless they affect users.
- Vague “improvements and fixes.”
- Fake momentum.

### `/roadmap`

Update when:

- A “Next” item ships.
- A priority is dropped.
- A planned feature becomes unrealistic.
- A user-facing timeline is communicated elsewhere.

Rules:

- Keep dates conservative.
- Avoid promising unscoped features.
- Move completed items into the changelog.
- Mark uncertain items as exploratory.

### `/about`

Update when:

- Company/legal structure changes.
- Founder bio or operating model changes.
- YouInc expands beyond NZ-first positioning.
- The brand story changes.

Must eventually include:

- Legal entity details, if relevant.
- Founder background.
- Operating principles.
- Location and jurisdiction clarity.

### `/compare`

Update when:

- Product positioning changes.
- Competitor pages change.
- New direct alternatives emerge.
- YouInc adds or removes key capabilities.

Rules:

- Be fair to competitors.
- Avoid unverifiable claims.
- Say who YouInc is not for.

### `/use-cases`

Update when:

- Real customer-approved stories exist.
- Use cases become supported by actual widgets or workflows.
- Concierge examples are shipped and can be described without exposing private data.

Rules:

- Do not invent customer names, logos, testimonials, or outcomes.
- Label examples clearly until they become approved case studies.

## "What changed, which pages must update?" matrix

Use this when any product, legal, or operational reality shifts. Find the change on the left; update every page marked. Bold means the page is the primary source of truth for that fact and must not be allowed to drift.

| Change | privacy | terms | security | data-deletion | integrations | contact | docs | help | status | changelog | roadmap | about | compare | use-cases |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bank provider or Akahu scope changes | ✓ | | ✓ | ✓ | **✓** | | ✓ | ✓ | | ✓ | | | ✓ | |
| Supported institutions change | | | | | **✓** | | ✓ | ✓ | | ✓ | | | | |
| Auth method changes (passkey/WebAuthn) | ✓ | ✓ | **✓** | | | | ✓ | ✓ | | ✓ | | | | |
| Storage / retention / backup changes | **✓** | | ✓ | ✓ | | | | | | ✓ | | | | |
| Export format or availability changes | ✓ | ✓ | | **✓** | ✓ | | ✓ | ✓ | | ✓ | | | ✓ | ✓ |
| Deletion process changes | ✓ | | | **✓** | | ✓ | | ✓ | | ✓ | ✓ | | | |
| Pricing / billing / refund / tax changes | | **✓** | | | | | | ✓ | | ✓ | | | ✓ | |
| Support contact or response targets change | ✓ | ✓ | ✓ | ✓ | | **✓** | ✓ | ✓ | ✓ | | | | | |
| Domain email inboxes go live | **✓** | ✓ | ✓ | ✓ | | **✓** | | ✓ | ✓ | ✓ | | | | |
| New subprocessor / vendor added | **✓** | | ✓ | | ✓ | | | | | ✓ | | | | |
| Security review / pentest completed | | | **✓** | | | | | | | ✓ | ✓ | | ✓ | |
| Material incident occurs | | | ✓ | | | ✓ | **✓** | | ✓ | | | | |
| Public availability / access model changes | ✓ | ✓ | | | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Legal entity incorporated / named | **✓** | **✓** | | | | ✓ | | | | ✓ | | ✓ | | |
| Jurisdiction / governing law confirmed | **✓** | **✓** | | | | | | | | ✓ | | ✓ | | |
| New integration shipped | ✓ | | ✓ | | **✓** | | ✓ | ✓ | | ✓ | ✓ | | ✓ | ✓ |
| AI feature that touches financial data | **✓** | ✓ | **✓** | | ✓ | | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | |
| Real customer story approved | | | | | | | | | | ✓ | | | ✓ | **✓** |

Rule of thumb: if a change touches money, bank data, identity, or where data lives, assume privacy + security + data-deletion all need a look, plus a changelog entry.

## Pre-publish review checklists

Run the relevant checklist before merging copy changes to these pages.

### Trust/legal pages (`/privacy`, `/terms`, `/security`, `/data-deletion`)

- [ ] Every factual claim is verifiable from the codebase, infra, or a signed agreement.
- [ ] No unverified compliance, certification, or "bank-grade" language.
- [ ] Encryption/backup claims match what is actually configured.
- [ ] Contact address is correct and monitored.
- [ ] Anything not yet true is clearly marked as planned/roadmap, not stated as fact.
- [ ] Items needing legal or security sign-off are flagged (see triggers below).
- [ ] "Last updated" date bumped.

### Resource pages (`/docs`, `/help`, `/integrations`, `/status`, `/changelog`, `/roadmap`)

- [ ] Steps match the current product flow (sign-in, connect, export, delete).
- [ ] Internal links resolve to real routes.
- [ ] No promises of features that are not built.
- [ ] Roadmap dates are conservative or omitted; shipped items moved to changelog.
- [ ] Status reflects reality; no stale "no known issue" during an active incident.

### Company/marketing pages (`/about`, `/compare`, `/contact`, `/use-cases`)

- [ ] No invented customers, testimonials, logos, metrics, headcount, or SLAs.
- [ ] Founder-led framing stays honest (see rule 3).
- [ ] Competitor claims are fair and verifiable.
- [ ] Use cases are labelled as product capabilities, not customer outcomes, until approved.

## When to get legal or security review

Get **legal review** before publishing when a change involves:

- The legal entity name, address, or governing-law/jurisdiction clause.
- Liability limitations, warranties, indemnities, or dispute resolution.
- Payment, refund, cancellation, subscription, or tax terms that bind users.
- A new class of personal data, a new subprocessor, or cross-border data transfer.
- Any statement about compliance with a named law or standard.

Get **security review** (and verify against implementation) before publishing when a change involves:

- Authentication, session handling, or access control.
- Encryption at rest or in transit, key management, or backups.
- The tenant-isolation / row-level-security model.
- Incident-response commitments or disclosure timelines.
- Any claim of an audit, penetration test, or certification.

When either review happens, record the reviewer and date in the PR and do not silently rewrite reviewed clauses without another review.

## Maintaining changelog, status, and roadmap over time

These three pages are what make "founder-led" read as "maintained" rather than "abandoned". Treat them as a system:

- **Changelog is the ledger of what happened.** Add a short, dated, user-facing entry whenever something visible ships. Newest date on top. Never backdate or invent momentum. When a `/roadmap` "Now/Next" item ships, write the changelog entry in the same PR.
- **Roadmap is the forward promise, kept deliberately vague on timing.** Keep the Now / Next / Later buckets. Move shipped items out of Now and into the changelog. Drop items honestly when priorities change rather than letting them rot. Mark uncertain items as exploratory. Do not put dates you are not confident about.
- **Status is the truth about right now.** During normal operation it can stay a short "no known issue" list. The instant something breaks (bank sync, demo, app, support availability), update it *first*, before fixing, and log the incident with date, affected systems, user impact, and resolution. Stale status is worse than no status.

Cadence tie-in: every release touches changelog; roadmap is reviewed at least each release; status is event-driven and must be updated immediately on any incident.

## Launch-readiness checklist

Before sending significant public traffic to these pages:

- [ ] Replace Gmail contact with domain-specific product inboxes.
- [ ] Confirm all social links point to real, maintained profiles or remove them.
- [ ] Get legal review for `/privacy` and `/terms`.
- [ ] Verify every security claim against actual implementation.
- [ ] Confirm Akahu wording is accurate and approved where necessary.
- [ ] Add a real deletion/export process with response expectations.
- [ ] Decide whether `/status` remains manual or moves to a hosted status page.
- [ ] Add screenshots and task walkthroughs to `/docs` and `/help`.
- [ ] Add a recurring review calendar for trust pages.

## Suggested review cadence

| Cadence | Review |
| --- | --- |
| Every release | Changelog, docs, help, roadmap |
| Monthly during early access | Privacy, security, integrations, data deletion |
| Quarterly | Terms, about, compare, use cases |
| Immediately | Any security incident, data handling change, vendor change, pricing change, or bank-sync change |

## Source files

The current pages are defined in:

- `frontend/src/components/marketing/staticPages.tsx` (all copy)
- `frontend/src/components/marketing/StaticMarketingPage.tsx` (shared layout)
- `frontend/src/components/marketing/staticPageRoute.tsx` (route + `<head>` glue)
- `frontend/src/components/marketing/static-page.css`
- `frontend/src/routes/*.tsx` for each route (one thin file per slug)

Discovery is defined in:

- `frontend/src/components/marketing/MarketingFooter.tsx` (Product / Resources / Trust / Company columns)
- `frontend/src/components/marketing/MarketingHeader.tsx` (top nav also exposes Docs and Security)

Coverage:

- `frontend/e2e/marketing-pages.spec.ts` checks every static page loads publicly (not redirected to `/login`) and that footer Trust links and header Docs/Security links route correctly. Add a row to the `STATIC_PAGES` list there whenever a new slug is added.
