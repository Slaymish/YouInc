# YouInc Ledger — Competitor Research & Positioning

*Compiled 2026-07-04. Web research; all prices verified against the cited source pages on that date unless flagged "unverified."*

---

## TL;DR

**Positioning:** Lead with "personal ERP for people who outgrew budgeting apps" — a local-first, double-entry ledger (Akahu-fed, hledger-exportable) for power users PocketSmith/YNAB frustrate, plus a paid bespoke-build arm ("I build your custom finance/AI infrastructure") that no direct competitor offers to individuals. No consumer finance competitor combines strict double-entry + data ownership + a human building custom automation for you — this is genuinely open ground, not a crowded angle.

**Pricing recommendation:**
- **Self-serve hosted:** NZD $14.95/mo or $9.95–11/mo billed annually (~$120–132/yr) — priced to sit just under PocketSmith Flourish (NZD $16.66–24.95/mo) but above its Foundation tier, signalling "more capable, not cheaper toy." Keep a genuinely useful free tier (1–2 accounts, manual import) for funnel/demo purposes, matching PocketSmith/Steady's free-tier convention.
- **Bespoke builds:** one-off build fee from NZD $1,500–5,000 (scoped per widget/integration) + optional ongoing retainer NZD $150–400/mo for maintenance, new connections, and AI features — anchored below typical freelance FP&A/dashboard-consultant day rates (NZ$800–1,500/day) but priced as a premium, not commodity, service.

**Caveats on data:** Some prices (Monarch's older single-tier pricing, exact NZD PocketSmith history, Akahu's exact wholesale connectivity fee) shift year to year or were given as ranges by vendors rather than fixed figures — flagged inline below.

---

## 1. Competitor Profiles

### PocketSmith (NZ — most important anchor)
- **Positioning:** NZ-founded (Dunedin, 2008) calendar-based budgeting + long-range financial forecasting (up to 60 years). The most "power user" of the mainstream consumer apps.
- **Pricing (NZD, confirmed on pricing page):**
  - Free: 2 accounts, 2 dashboards, 12 budgets, 6-month projection, automatic bank feeds.
  - Foundation: NZD $9.99/mo billed annually (NZD $14.95/mo month-to-month) — 6 connected banks (1 country), 6 dashboards, 10-yr projection, unlimited accounts/budgets.
  - Flourish (most popular): NZD $16.66/mo annually (NZD $24.95/mo monthly) — 18 banks/all countries, 18 dashboards, 30-yr projection.
  - Fortune: NZD $26.66/mo annually (NZD $39.95/mo monthly) — unlimited banks, unlimited dashboards, priority support, 60-yr projection.
  - Source: https://my.pocketsmith.com/plans
- **Target user:** Forecast-driven planners, NZ/AU users wanting local bank coverage (ANZ, ASB, BNZ, Kiwibank, Westpac, TSB via Akahu), spreadsheet-adjacent power users.
- **What worked:** Deep forecasting engine, calendar view, longest NZ track record, full local bank coverage.
- **What fails/gets complained about:** Mobile app is widely criticized as a weak companion to the web app ("very poor, especially given this is an expensive subscription service" — per review aggregation); steep learning curve ("training a puppy" per Reddit); one documented incident of a staff member accessing a user's account and altering budget data without authorization (privacy trust issue); missing basic comparison charts (month-over-month bar graphs) that competitors have. Sources: https://www.pocketkiwi.com/post/pocketsmith-review-of-reviews , https://www.propercents.com/reviews/pocketsmith-budget-app-review/
- **AI:** No prominent AI-assistant feature as of this research (unlike Monarch/Copilot/Steady) — this is a gap YouInc Ledger and Steady are positioned to exploit.

### Mint (shut down)
- **Timeline:** Intuit announced shutdown Oct 31 2023; effective shutdown March 23 2024, after a ~4.5-month CSV export window. Source: https://www.monarch.com/blog/mint-shutting-down
- **Why it died:** Not a product failure so much as a business-model/portfolio decision — Intuit consolidated consumer finance around Credit Karma (acquired 2020) rather than run two overlapping ad-supported products. Mint monetized via ads and referral fees for financial products (same model as Credit Karma), so keeping both was redundant for Intuit's P&L. Source: https://orbitmoney.io/blog/what-happened-to-mint
- **Migration pain:** Budgets, goals, bill reminders, custom categories and recurring-transaction labels did NOT migrate to Credit Karma — users lost years of categorization work. This is a direct, still-fresh trust wound in the market ("my finance app can vanish and take my data with it") that a local-first, exportable (hledger) product directly answers.
- **Lesson:** Free ad-supported finance apps are structurally fragile — the user is not the customer. Any product whose revenue depends on data-brokering/lead-gen is one acquisition away from shutdown.

### Monarch Money
- **Positioning:** Mint's most direct "spiritual successor," founded by Mint's first PM; couples/household-shared budgeting emphasis.
- **Pricing:** Two tiers as of 2026 — Monarch Core, USD $99.99/yr (~USD $8.33/mo), includes AI Assistant, unlimited account sync, shared "Household" access; Monarch Plus, USD $199/yr, adds business tracking and advanced investment analytics. (~NZD $175–350/yr at ~1.76 USD/NZD.) No published free tier — trial only. Sources: https://checkthat.ai/brands/monarch/pricing , https://help.monarch.com/hc/en-us/articles/16116906962452-About-Monarch-s-AI-Features
- **Target user:** Couples/households wanting a clean Mint-replacement with shared visibility.
- **What worked:** Strong design, credible "we get it, we built the thing you lost" founder narrative post-Mint.
- **What fails/gets complained about:** Search results (this pass) surfaced only generic complaint categories (sync reliability, institution coverage, UI gripes) without a strong primary source — **flagging as under-verified**; recommend a follow-up Reddit/Trustpilot deep-dive before quoting specifics publicly.
- **AI:** Yes — three named features: AI Assistant (natural-language Q&A over your data), AI Insights, and a Weekly Recap; also AI-driven auto-categorization and "explain this transaction." This is the most AI-forward mainstream competitor.

### Copilot Money
- **Positioning:** Design-led, Apple-ecosystem-native (iOS/Mac/iPad; web added Dec 2025), premium positioning.
- **Pricing:** USD $13/mo billed monthly, or USD $95/yr (~USD $7.92/mo) billed annually. 30-day free trial, no permanent free tier. (~NZD $23/mo or ~NZD $167/yr.) Source: https://copilot.money/pricing/
- **Target user:** Design-conscious Apple users wanting minimal-friction categorization.
- **What worked:** "Copilot Intelligence" — a per-user private ML model for categorization; users report needing to correct only ~20% of transactions after an initial 30-transaction training pass.
- **What fails/gets complained about:** iOS-only for most of its life (web is brand new and reportedly limited); premium price; power-user feature gaps (per Forbes Advisor review). Source: https://www.forbes.com/advisor/banking/copilot-budget-app-review/
- **AI:** Yes, and it's the core product differentiator — private-per-user categorization model, not a generic chatbot bolted on.

### Lunch Money
- **Positioning:** Indie, developer-friendly, "budget your way, not our way" — multi-currency, crypto support, API access.
- **Pricing:** USD $10/mo, or "pick your price" annual from USD $50/yr. 30-day trial (60 days via referral links). No ads, no data-selling. Source: https://lunchmoney.app/pricing
- **Target user:** Technically literate users, digital nomads, crypto holders, people who want an API.
- **What worked:** All-inclusive pricing (no upsell tiers), community trust ("never see an ad," responsive small-team support), developer API as a real feature not an afterthought.
- **What fails/gets complained about:** Limited direct complaint data surfaced this pass; general sentiment is strongly positive relative to peers — likely because its niche (devs/power users) self-selects for tolerance of a leaner feature set.
- **AI:** Not a headline feature (as of this research pass) — positions itself on flexibility/control rather than automation.

### Actual Budget
- **Positioning:** Open-source, local-first, YNAB-alternative envelope budgeting; self-hostable.
- **Pricing:** Core software free/open-source. Official hosted sync service ~USD $7.95/mo (or comparable community-hosted options like ElfHosted ~USD $9/mo; some users report paying as little as ~USD $1.50/mo for hosting + ~USD $15/yr for a SimpleFIN bank-sync bridge). Source: https://actualbudget.org/ , https://store.elfhosted.com/product/actual-budget/
- **Target user:** Privacy-conscious self-hosters, technical users who want YNAB's method without YNAB's price or cloud dependency.
- **What worked:** Genuine local-first architecture, active development, SimpleFIN bank sync reported reliable, envelope budgeting UX praised as polished for an open-source tool.
- **What fails/gets complained about:** Self-hosting is a real barrier — Docker/server/backup management is beyond most consumer users; this caps its addressable market to technical households.
- **AI:** None notable — this is the closest philosophical sibling to YouInc Ledger (local-first, user-owned data) but has no AI layer and no bespoke-build offering, and its self-hosting requirement is a wall YouInc Ledger's hosted option can remove.

### YNAB (You Need A Budget)
- **Positioning:** Prescriptive methodology app ("Four Rules," zero-based budgeting) — sells behavior change, not just tracking.
- **Pricing:** USD $109/yr (originally a one-time $60 purchase, then $50/yr → $84/yr → $99/yr → $109/yr today). ~NZD $190+/yr. Source: https://www.fincomparelab.com/guides/ynab-pricing/
- **Target user:** People in active debt payoff / habit-change mode who want a system, not just visibility.
- **What worked:** Category-tested — users who follow the method report large concrete outcomes (e.g., "paid off $14,000 in credit card debt in 18 months" — r/ynab). This is direct evidence that outcome-driven apps retain where trackers don't.
- **What fails/gets complained about:** Relentless price creep is the #1 complaint and a recurring meme in reviews; passive/non-engaged users call the price "unjustifiable" once they stop actively budgeting; US bank-sync flakiness (Plaid) with smaller institutions. Source: https://www.budgetpeer.com/blog/ynab-vs.-a-one-time-payment-budget-app-is-the-subscription-worth-it
- **AI:** No first-party AI assistant of note; third-party tools (ChatBudget, FinInsights, an MCP server) have sprung up around YNAB's API to fill this gap — signal that YNAB's own user base wants AI features YNAB hasn't shipped.

### Tiller
- **Positioning:** Automated bank-sync data feed into a user-owned Google Sheets/Excel spreadsheet — "spreadsheet with automation," not an app.
- **Pricing:** Single plan, USD $79/yr (~USD $6.58/mo), no free tier, 30-day trial. (~NZD $139/yr.) Source: https://sheetlink.app/tiller-money-pricing-2026
- **Target user:** Spreadsheet power users who want full control of formulas/layout but don't want to hand-enter transactions.
- **What worked:** "Best $79 you'll spend" sentiment among spreadsheet enthusiasts; AI-assisted categorization added 2024 fixed its historically weakest point; total user control of the data layer.
- **What fails/gets complained about:** No dedicated mobile app is the #1 complaint (users fall back to Google Sheets/Excel mobile, which is poor for on-the-go entry); intimidating to non-spreadsheet users.
- **AI:** Added AI categorization in 2024; otherwise leans on the user's own formula work rather than AI insights.

### Steady (NZ, Akahu-powered)
- **Positioning:** NZ-built, AI-native budgeting/forecasting app targeting mainstream (not power-user) Kiwis — direct competitor to PocketSmith at the low end and the closest thing to an "Akahu app gallery" consumer competitor found in this research.
- **Pricing:** Free plan (1 bank connection, 90 days history, 1 savings goal, 5 AI questions/month); Plus plan from NZD $6.50/mo (3-month promo) reverting to NZD $12.99/mo, adding unlimited AI questions, unlimited banks, forecasting, net worth tracking. Source: https://steady.nz/pricing
- **Target user:** Everyday NZ consumers wanting a "financial health score" and AI-answered questions, not double-entry rigor.
- **AI:** Central to the product — AI categorization, a numeric "financial health score," and metered "AI questions" as the paid-tier lever. This is the most direct local evidence that NZ users will pay for AI-gated finance features.
- **Note:** Other names surfaced in Akahu's ecosystem search (Dosh, BUCK, Dolla, MoneyHub) are mostly either digital-wallet/payments products or comparison-site content publishers, not double-entry/ledger competitors — no additional close NZ competitor to YouInc Ledger's positioning was found. Source: https://www.akahu.nz/ , https://www.moneyhub.co.nz/open-banking.html

### Akahu itself (infrastructure, not a competitor, but a cost input)
Relevant because YouInc Ledger's own COGS run through it. Akahu's published developer pricing: one-off Payments API ~$0.15/successful payment; one-off Data API ~$5.00/application or ~$1.00/successful identity/account-verification request; **ongoing Connectivity API "typically $0.50–$2.50 per user per month"** (final fee negotiated per use case); "Personal Apps" (building for your own data only) get free API access. Source: https://www.akahu.nz/pricing — **flagging this as a range, not a confirmed number for YouInc Ledger's specific deal**, since Akahu says exact fees are "confirmed after understanding specific needs."

---

## 2. Failure / Success Lessons

1. **Ad-funded and lead-gen-funded apps are structurally unstable.** Mint's death wasn't a product failure, it was a business-model dead end — the user was never the customer. Any competitor whose free tier is "free forever, ads/data-broker funded" carries this same tail risk. YouInc Ledger's straightforward-subscription model is a feature to say out loud, not just an implementation detail.

2. **Data portability is now a trust signal, not a footnote.** The Mint shutdown's worst pain wasn't losing the app, it was losing years of categorization/budget history that didn't migrate. hledger export as a first-class feature directly answers a wound that's still fresh in the market's memory (2024, well within recall).

3. **Apps that produce a measurable outcome retain; apps that are "just a dashboard" don't.** YNAB users who follow the method report large concrete wins and tolerate real price increases; pure trackers see brutal ~4.2% Day-30 retention industry-wide (per aggregated fintech UX research). The lesson for YouInc Ledger: market outcomes (clean books, real-time net worth, hledger-exportable records you can hand an accountant) not just "see your transactions."

4. **Power users will pay real money for control, and they self-select for a smaller, more loyal market.** Tiller ($79/yr, no free tier) and Lunch Money ($10/mo, no ads, API access) both thrive on modest user counts because their audience explicitly wants more control, not more hand-holding. This is the same audience YouInc Ledger's double-entry / hledger-export positioning targets — a real market exists at this altitude, and it doesn't require competing with Steady or Monarch's mainstream-AI approach.

5. **Mobile-web asymmetry is a widely shared, unaddressed pain point.** PocketSmith and Tiller both get hit hardest for a weak or absent mobile experience versus their web/desktop depth. If YouInc Ledger's dashboard is React-based and reasonably responsive out of the gate, that alone is a differentiator against two of the closest analogues.

6. **AI is now table stakes at the mainstream tier, not yet claimed at the power-user tier.** Monarch, Copilot, and Steady all ship AI (assistant, categorization, or both) and gate part of it behind payment (Steady explicitly meters "AI questions"). But none of PocketSmith, Tiller, Lunch Money, Actual Budget, or YNAB (natively) has strong AI — and none of them offer a *human* to build bespoke automation. That combination (strict double-entry rigor + AI infrastructure + a real developer behind it) is unclaimed.

7. **The "gap" for a personal ERP / double-entry / power-user positioning:** every reviewed competitor is either (a) a single-tier SaaS app for the mass market (Monarch, Copilot, Steady, YNAB) or (b) a DIY/self-hosted tool with no vendor relationship (Actual Budget, hledger raw). Nobody occupies "professional-grade double-entry ledger, hosted for you, with the option to pay a real person to extend it" — that's the wedge.

---

## 3. Pricing Recommendation

### (a) Self-serve hosted product

| Anchor | Price | Why |
|---|---|---|
| PocketSmith Foundation | NZD $9.99–14.95/mo | Floor — don't price below the entry tier of the closest NZ analogue, or the product reads as a cheaper toy. |
| PocketSmith Flourish | NZD $16.66–24.95/mo | Ceiling for self-serve — going above this without a much bigger feature set invites direct comparison you'll lose on breadth (PocketSmith has 15+ years of feature accretion). |
| Steady Plus | NZD $12.99/mo | Local proof NZD $12–13/mo is a psychologically accepted price point for an AI-assisted NZ finance app. |

**Recommendation:** NZD $14.95/mo billed monthly, or **~NZD $9.95–11/mo billed annually (~$119–132/yr)**. This sits at PocketSmith's Foundation price but should be positioned against Flourish-level capability (unlimited bank connections via Akahu, full double-entry, hledger export, customizable widget dashboard) — i.e., price like the entry tier, deliver like the premium tier, and let the double-entry/export/local-first story justify not needing a third upsell tier. Keep a free tier (2 accounts / manual import / limited dashboard, matching the PocketSmith/Steady convention) purely as a demo/waitlist-to-paid funnel, not a sustainable free plan.

Avoid YNAB's mistake: don't creep the price upward every year in small increments — that pattern is now a documented, named complaint pattern across review sites. If a price change is needed, do it once, communicate why, and tie it to a real capability jump.

### (b) Bespoke / custom build engagements

No consumer competitor in this research offers anything comparable — the anchor has to come from adjacent freelance/consulting markets, not from the finance-app competitors themselves.

- **One-off build fee:** NZD $1,500–5,000 per engagement (custom widget, bank/data integration, or AI automation), scoped like a small project rather than an hourly quote. Upwork/FP&A freelance dashboard-builder day rates run roughly NZ$800–1,500/day (unverified precise NZ figure — sourced from general freelance-financial-analyst listings, not NZ-specific data — treat as directional only), so a 2–5 day-equivalent scoped build at $1,500–5,000 reads as fair-but-premium rather than commodity hourly work.
- **Ongoing retainer:** NZD $150–400/mo for maintenance, new bank/data connections, and iterative AI feature work — priced above the self-serve subscription (signals "this is a relationship, not a plan") but well under a part-time contractor rate, since it's amortized across infrastructure Hamish already maintains for the core product.
- **Rationale:** this tier's price should feel expensive relative to the SaaS plan (10–30x) because it's genuinely bespoke labour, but cheap relative to hiring a contract developer directly, because the buyer is paying for someone who already knows the ledger/Akahu/hledger stack cold.

---

## 4. Differentiation Recommendations (ranked)

1. **"Personal ERP, not a budgeting app" — strict double-entry + hledger export as the trust anchor.** Rationale: directly answers the Mint-shutdown data-loss wound and the "my app might vanish" anxiety that's still live in the market; no mainstream competitor (Monarch, Copilot, Steady, YNAB) offers a real accounting-grade export, and Actual Budget/hledger require full self-hosting to get this. This is the single most defensible, hardest-to-copy claim.

2. **"I'll build your custom finance/AI infrastructure" — the bespoke-build arm.** Rationale: this is genuinely uncontested — every reviewed competitor is either a faceless SaaS or a leaderless open-source project; none pairs a real product with a named developer who'll build you something custom. For NZ small-business owners, consultants, or high-net-worth individuals who've outgrown template dashboards, this converts "developer credibility" (hamishburke.dev) directly into revenue instead of leaving it as a portfolio footnote. Evaluated explicitly: this angle is strong specifically because it's not trying to out-AI Monarch/Copilot/Steady on a mass-market feature race Hamish can't win as a solo dev — it reframes AI/automation depth as a *service*, where solo-dev attention is the value, not a liability.

3. **Local-first + Akahu-native, built for NZ banks specifically.** Rationale: PocketSmith is the only mainstream competitor with equally deep NZ bank coverage, and it's visibly under-investing in mobile and showing a real (if isolated) trust incident. A newer, better-mobile, NZ-first alternative aimed at the same forecast-and-forensics audience has room.

4. **Widget-based customizable dashboard vs. fixed report screens.** Rationale: every competitor reviewed ships a fixed set of report/insight screens; none offers a genuinely user-composable widget dashboard. This is a concrete, demoable differentiator (the existing interactive demo) and pairs naturally with angle #2 — "don't like a stock widget? I'll build you one."

5. **Outcome-framed marketing over tracking-framed marketing.** Rationale: the research shows outcome-driven products (YNAB, Rocket Money) retain; tracking-only products don't (~4.2% Day-30 industry retention). YouInc Ledger should market "clean, auditable books you can hand to an accountant" or "always know your real net worth," not "see your transactions" — same product, framed around a result rather than a feature.

**On the "custom builds / I build your AI finance infrastructure" angle specifically:** it is the highest-leverage differentiator found in this research precisely because it's absent from every competitor profiled — Monarch, Copilot, and Steady compete on shipping AI *to* everyone at once; none of them can offer a client a developer who'll build *for* them specifically. The risk is that it doesn't scale (it's explicitly a solo-dev, high-touch service), so it should be framed as a premium adjunct to the self-serve product, not the primary funnel — the free demo and self-serve tier need to carry volume; the bespoke arm converts the highest-intent subset.

---

## Sources (all fetched/searched 2026-07-04)

- https://my.pocketsmith.com/plans
- https://www.pocketsmith.com/global-personal-finance-software/new-zealand/
- https://www.pocketkiwi.com/post/pocketsmith-review-of-reviews
- https://www.propercents.com/reviews/pocketsmith-budget-app-review/
- https://www.monarch.com/blog/mint-shutting-down
- https://orbitmoney.io/blog/what-happened-to-mint
- https://blog.logrocket.com/product-management/why-is-the-mint-app-shutting-down/
- https://checkthat.ai/brands/monarch/pricing
- https://help.monarch.com/hc/en-us/articles/16116906962452-About-Monarch-s-AI-Features
- https://help.monarch.com/hc/en-us/articles/37526856682260-AI-in-Monarch
- https://copilot.money/pricing/
- https://www.forbes.com/advisor/banking/copilot-budget-app-review/
- https://lunchmoney.app/pricing
- https://actualbudget.org/
- https://store.elfhosted.com/product/actual-budget/
- https://www.fincomparelab.com/guides/ynab-pricing/
- https://www.budgetpeer.com/blog/ynab-vs.-a-one-time-payment-budget-app-is-the-subscription-worth-it
- https://www.trustpilot.com/review/ynab.com
- https://sheetlink.app/tiller-money-pricing-2026
- https://www.akahu.nz/
- https://www.akahu.nz/pricing
- https://www.akahu.nz/consumer
- https://steady.nz/pricing
- https://www.moneyhub.co.nz/open-banking.html
- https://hledger.org/
- https://plaintextaccounting.org/
- https://wise.com/us/currency-converter/usd-to-nzd-rate (exchange-rate context, ~1.76 USD/NZD as of 2026-07)
