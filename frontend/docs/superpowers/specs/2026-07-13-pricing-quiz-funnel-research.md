# Research digest — quiz-funnel onboarding & soft paywalls, applied to YouInc

Date: 2026-07-13
Source: deep-research workflow (run wf_7be1b99c-9d8). Synthesis step aborted on
org monthly spend limit; searches + source extraction completed first, so
findings below are intact. Confidence tags:
- **[VERIFIED 3-0]** — passed 3-vote adversarial fact-check.
- **[COLLECTED]** — extracted from a named source but its verification votes
  errored out on the spend limit (NOT refuted; treat as credible-but-unconfirmed).

## 1. Psychology (why these funnels work)

- **IKEA effect / endowment** [COLLECTED] — people value what they helped build;
  Norton, Mochon & Ariely (2012) showed people pay more for self-assembled items.
  Driven by effort-justification (cognitive dissonance). Source: learningloop.io.
  → For YouInc this is unusually strong leverage: the onboarding answers *are* the
    product (their ledger), not throwaway quiz data.
- **Sunk cost / commitment & consistency** [COLLECTED] — each quiz step raises
  psychological commitment; by the end, giving an email/paying feels consistent
  with the effort already spent. Noom's 10–15 min / ~66–113-screen quiz is the
  canonical example. Sources: web2appworld, deceptive.design, RevenueCat teardown.
- **Goal-gradient / "light at the end of the tunnel"** [COLLECTED] — progress
  framing + a personalized result screen that feels "already loaded in."

## 2. Funnel anatomy (the pattern, in order)

1. Compelling promise/hook up front (outcome, not features).
2. Easy low-commitment quiz — sliders + multiple choice. **3–5 personalization
   screens before the paywall convert best; ~5 questions is the sweet spot**
   between completion and commitment. [COLLECTED — Airbridge, RocketShip/Adapty]
3. **Account/email capture AFTER investment, not before.** Cal AI moved sign-in
   to the END of onboarding to cut friction and lift conversion. Noom captures
   email right after the results "loader." [COLLECTED — getlatka, RevenueCat]
4. Personalized results/plan screen — the "already yours" reveal.
5. Soft paywall — locked/blurred extras, "unlock your plan," often a trial.
   Cal AI shows a paywall to ~87% of new users during onboarding. [COLLECTED]

## 3. Benchmarks / evidence (2024–2026)

- **Hard paywalls convert ~5x freemium at day 35 (10.7% vs 2.1% median), but
  year-one retention is nearly identical.** [VERIFIED 3-0 — RevenueCat State of
  Subscription Apps, 115k+ apps]. Caveat [COLLECTED]: headline hard-paywall rates
  suffer survivorship bias; ~23% of freemium conversions happen 6+ weeks out.
- Free-trial length: 17–32 day trials convert ~42.5% vs ~25.5% for <4 day; 3-day
  trials trigger 55%+ day-0/1 cancellation vs ~31% for 30-day. [COLLECTED —
  RevenueCat]. Only ~28% of subscription apps avoid trials. [COLLECTED]
- Cal AI: heavy paywall A/B testing (123 experiments, 424 variants via Superwall);
  3-day trial; AI core feature locked, free tier deliberately thin. [COLLECTED]

## 4. Ethics / dark-pattern & regulatory risk

- **FTC Oct-2021 policy statement** [VERIFIED 3-0]: subscription sign-ups must be
  clear, consensual, easy to cancel; **disclose all material terms up-front**
  (cost, cancel deadline, charge amount/frequency) **as prominently as the offer**;
  obtain **express informed consent for auto-renewal, separately** from the rest.
- **Noom paid $62M** ($56M cash + $6M credits) to settle a class action over its
  trial→auto-renewal funnel (non-refundable fees up to $199, auto-renew without
  explicit consent). [COLLECTED — deceptive.design, Hunton]
- ~76% of 642 subscription sites/apps used ≥1 dark pattern (Jan-2024 FTC/ICPEN/GPEN
  sweep); commonest were "sneaking" and "interface interference." [COLLECTED]

**The line:** the *quiz/onboarding* is not what gets punished — the *billing* is.
Noom's quiz was fine; its hidden auto-renew + hard-to-cancel + non-refundable
charge was the violation. Defensible version = investment-building onboarding +
scrupulously honest paywall (clear price, easy cancel, no trick auto-charge).
Finance is more trust-sensitive than dieting, so the honesty bar is higher.

## Applied recommendation for YouInc (summary)

- **The quiz IS manual account entry, disguised as onboarding.** 4–6 friendly
  questions ("roughly what's in your everyday account? KiwiSaver? mortgage? car?")
  each write one `manual_account_balances` row. Feels like a quiz; builds a ledger.
  This turns the IKEA/endowment effect into real product value, not a trick.
- **No "create an account" up front.** Capture account/email at the reveal, once
  the dashboard is populated (validated by Cal AI moving sign-in to the end).
- **Reveal = the endowment moment:** their real net worth / asset mix / widgets,
  live, built by them.
- **Reframe free→paid as "keep this alive," not "pick a plan":** the soft paywall
  is live bank sync ($15/mo) — "your numbers are yours; want them to update
  themselves?" Manual balances go stale; sync keeps them current.
- **Honesty guardrails (non-negotiable given finance + FTC):** show the $15 and
  "cancel anytime" plainly; if a trial is used, get explicit consent and never
  silently auto-charge. Longer trial (or none) beats a 3-day trap.
- **Concierge stays as the high price anchor**, off to the side.
