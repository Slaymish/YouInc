# Standing spending authority

The limits, not the payment rail. This directory decides whether a purchase may
proceed unattended; it never holds a card number, a CVC or an API key.

```sh
cd ~/Developer/YouInc/youinc
cp spend-authority/policy.yaml.example ~/.youinc/spend-policy.yaml   # then edit
npm test    # 20 tests: the ladder, monthly sums, allowlist, hard blocks
```

## Why it is separate from the ledger

Wallet bookkeeping must never be able to corrupt the books. The authority keeps
its own SQLite file (`purchases.sqlite3`) with an append-only trail:

1. an **intent** is written *before* any money moves (what, where, why, decision),
2. an **outcome** is written after (`succeeded` / `failed` / `abandoned`),
3. an intent with no outcome still counts against the monthly limit — money that
   might be in flight can never be spent twice,
4. an intent is unique on `(at, purpose)`, so a retried run cannot double-buy.

## The rules encoded here

- **Notify mode buys nothing.** `mode: notify` is the starting state and every
  decision returns `blocked`.
- **Unattended requires a limit and an allowlist.** A policy saying
  `mode: unattended` with `per_purchase_limit: 0` or an empty allowlist is a
  parse error, deliberately: an unbounded card is not a configuration.
- **The monthly sum is checked**, not only the individual purchase.
- **Hard blocks are permanent**: gambling, crypto, cash advances, loans,
  insurance, investments — even if a later allowlist names them.
- **Commitments need a human**: anything recurring or contractual is refused
  when `createsCommitment` is set, regardless of amount.
- **No self-service increases.** This module reads a policy file; it cannot
  write one. Only a human edits limits.

## What is not built yet

The checkout. Attaching a funding card, browser automation and the merchant
list are deliberately out of scope until the funding card decision is made —
see `~/agent-system/proposals/agent-spending-authority-2026-10-17.md`.
