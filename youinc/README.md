# YouInc CLI — agent-first ledger

One SQLite file, one command. Balances come from the bank; the journal explains
them. No server, no browser, no Docker, no build step.

```sh
cd youinc
node cli.ts help          # everything below
node cli.ts status        # ledger path + whether credentials are present
```

Requires Node ≥ 22.13 (uses the built-in `node:sqlite`; TypeScript runs via
type stripping, so there is no compile step).

## The one idea

**The bank's stated balance is the truth. The journal explains the difference.**

```
ledger_balance(account) = anchor_cents + postings after anchored_at
```

`anchor_cents` is the last balance the bank reported, recorded with Akahu's own
`refreshed.balance` timestamp. So:

- the reported number is never reconstructed from transactions, so it cannot drift;
- a missed sync, a feed that does not exist, or history that predates the install
  cannot make a balance wrong;
- when the two figures disagree, that disagreement is reported, not silently recalculated;
- an unexplained difference never holds the balance back — the bank's figure stands
  and the difference is surfaced with its exact cents.

## Daily use

```sh
export AKAHU_APP_TOKEN=... AKAHU_USER_TOKEN=...     # never in a file in the repo
node cli.ts sync --refresh
node cli.ts balances --human
```

`sync` does four things in this order, and the order is the point:

1. refresh balances from the bank (`POST /v1/refresh`, then read `/v1/accounts`);
2. anchor each account at the stated balance;
3. import transactions into the window and post balanced journals;
4. pair transfers between his own accounts and post one journal per movement.

Anchoring before importing means a transaction is never counted twice: the
stated balance already contains everything up to its timestamp, and only
postings dated after it move the ledger.

## Transfers between own accounts

With two feeds synced, one transfer appears twice. Routed independently the
books either cancel the movement to nothing or book it as spending. So a matched
pair posts **one** balanced journal — debit destination, credit source — and
marks both raw rows `transfer_counterpart`.

Matching is strict on purpose, because a false pair corrupts two balances at once:
exactly equal absolute amount, opposite signs, different accounts, within 3 days,
and never between two accounts of a feed-less authorisation (a move inside
Sharesies Growth ↔ Emergencies is invisible on both sides — silence is not evidence).

```sh
node cli.ts pair-transfers --dry-run   # review before it touches the book
```

## Commands

| Command | What |
|---|---|
| `sync [--refresh] [--from] [--to] [--only acc_id] [--dry-run]` | refresh, anchor, import, pair |
| `balances [--human]` | per account: reported, age, ledger, status |
| `reconcile [--stale-after-hours N] [--human]` | only the accounts that disagree |
| `accounts [--human]` | mapped accounts and ledger paths |
| `refresh` | ask Akahu to refresh now |
| `doctor [--human]` | unbalanced journals, duplicate ids, unmapped accounts, stale anchors |
| `spend` / `income` / `cashflow` / `suspense` | reports, JSON or `--human` |
| `reclassify <external-id> --to Ledger:Account` | posts a correction, never rewrites history |
| `set-balance <acc_id> <amount> --as-of DATE` | manual snapshot for a feed-less account |
| `rule add --key K --match-regex R --to Ledger:Account` | categorisation without code |
| `rule list` / `rule disable <key>` | inspect and turn off |

Every command prints JSON by default and a table with `--human`. Exit 0 means the
command ran (even if it found drift); exit 2 means it could not be carried out.

## Reading it directly

The file is the API for reads:

```sql
-- balance per ledger account straight from postings
SELECT account,
       SUM(CASE side WHEN 'debit' THEN amount_cents ELSE -amount_cents END) AS cents
  FROM journal_entries GROUP BY account;
```

Use that for questions about movements. For "how much money do I have", use
`youinc balances` — it reads the anchors, which is the whole point.

## Schema

`user_version = 2`. The parts that carry the design:

- `journal_transactions` / `journal_entries` — double entry in integer cents, one currency per journal.
- `account_balances` — append-only history of every balance the bank stated.
- `account_basis` — which statement is currently the anchor, and why it moved.
- `transfer_pairs` — one row per movement between his own accounts, both raw hashes.
- `classification_rules` — pattern → ledger account, editable by `rule add`.
- `account_mappings` — Akahu id ↔ ledger path, plus `has_feed` and `connection_has_feed`,
  because "no transactions" and "no feed" are different facts.

## Tests

```sh
npm install
npm test          # 16 tests: anchoring, drift, stale, transfer pairing, corrections, CLI contract
npm run typecheck
```

Tests use temporary databases and a stubbed Akahu client — never the real ledger,
never the network, never credentials.
