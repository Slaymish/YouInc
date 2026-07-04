# Todo:

Done:

- [x] Add HB_logo.svh logo in footer that links to my site (hamishburke.dev)
- [x] Self serves confusing? Says start free? And doesn't actually let you start (waitlist button now says "Join the waitlist"; hero has a real free "Try the free demo" link)
- [x] Link to akahu
- [x] Add to FAQ: What if my account isn't in akahu? (can add manual accounts)
- [x] Another selling point: Can aggregate all your accounts into one place (folded into "How it works" step 1 copy)
- [x] Demo doesn't actually look like real dashboard (/demo now renders the real system-shell + DashboardGrid — tabs, drag/resize, widget picker — on sample data, scoped to a separate storage key and an allowlist that excludes session-gated mutation widgets)
- [x] Not sure about the grid of floating widgets... (hero cards kept; the showcase grid replaced with a framed miniature of the real dashboard — browser chrome, Entity Control header, six real widgets, serif margin annotations)
- [x] AI related stuff / pose as someone who can build AI infrastructure (bespoke section now pitches AI builds; new Concierge-examples section with Monday Brief email mock, AI anomaly flag, plain-English Q&A — explicitly framed as bespoke examples, not shipped features)
- [x] Improve iconography (official Akahu mark self-hosted in the proof strip; banks are designed chips with brand-hue dots — deliberately no scraped bank logo marks for trademark reasons)
- [x] Improve FAQ (7 specific entries: security detail, data location + hledger export, PocketSmith/budgeting-app comparison, AI widgets, cancellation/portability)
- [x] Multi page
  - [x] Custom builds page (/custom-builds — what I build, engagement steps, pricing anchors; header link no longer goes straight to the booking URL)
  - [x] Widget library page (/widgets — all 28 presentational widgets live on sample data, 4 account-gated ones as placeholders)
- [x] Research existing products (docs/research_competitors.md — profiles, failure/success lessons, pricing recommendation; TL;DR: "personal ERP for people who outgrew budgeting apps" + bespoke builds is open ground)
- [x] The idea needs to show the motivation better/have better framing (hero now leads with "you already have revenue, burn rate, and runway — you just can't see them")
- [x] Landing page feels AI-generated/generic
  - [x] Bespoke/high-effort widgets (dashboard-frame showcase + Concierge artifacts; also fixed sample-data accountType bug that blanked asset-mix/balance-sheet/liquidity/runway on /demo)
- [x] Pricing of competitors (research doc §3; self-serve kept at NZD $15/mo — just under PocketSmith Flourish; Concierge now anchors scoped one-off builds from NZD $1,500)
- [x] Notification/gist widget — marketing mock done (the Monday Brief artifact); the real email-delivery feature is still open, see below

***

- [ ] Feature: actually build the email summary/gist delivery (needs an email provider decision; touches session-gated server surface — deliberately deferred)
- [ ] Maybe work on infra: How this is all hosted and secure. (untracked supabase/ migrations + docs/architecture/ + tests/golden/ from separate work exist in the repo — not part of the marketing revamp branch)
- [ ] Optional polish (from review): demo opens with the red "books not decision-grade" exception from 50 sample suspense items — honest but alarming as a first impression; consider a calmer sample backlog. Action Center widget is tall/sparse at its default size.
