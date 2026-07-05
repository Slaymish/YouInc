# Golden characterization tests (Phase 0.5)

This directory pins the **Python `youinc_ledger` engine's exact behavior**
as language-agnostic JSON fixtures, establishing a parity contract for the
production TypeScript engine (`frontend/src/server/ledger-engine/*`). The
original Python fixtures were captured to ensure the TS port could be proven
byte-for-byte at parity before replacing the legacy system. The TS port is now
production; these fixtures remain as the source-of-truth for regression testing.

Captured: 2026-07-04, against `youinc_ledger` at the commit checked out on
`feat/marketing-revamp` (`config/rules.yaml` frozen into
`fixtures/rules_snapshot.yaml` at capture time -- see "Why a frozen rules
snapshot" below).

## The hard acceptance gate

> **`idempotency_hash` cross-language equality is the HARD P2 acceptance
> gate.** Every case in `fixtures/idempotency_hash.json` must produce a
> byte-identical SHA-256 hex digest from the TS port. This includes the
> "no akahu id" fallback path, where the hash embeds Python's `str()`
> formatting of the raw amount verbatim -- `"10.0"` and `"10.00"` hash
> differently. If the TS port normalizes amount strings before hashing (e.g.
> via a Decimal library's canonical string form), it WILL silently diverge
> from every already-persisted `idempotency_hash` in the real SQLite DB and
> reprocess the owner's entire transaction history as "new." This is the
> single highest-blast-radius bug the port can introduce.

## Language-agnostic fixture caveat: bare JSON floats

For real transactions the hash is always `sha256("akahu:{id}")` -- trivially
portable, no number formatting involved, since Akahu payloads always include
`_id`. The only path where amount-string formatting affects the hash is the
"no akahu id" fallback (`account_id|date|amount|description|merchant`),
which is entirely synthetic in this corpus (see below). Within that
fallback, a **bare JSON float that is integer-valued** (`"amount": 10.0`) is
deliberately **excluded** from the pinned cases: Python's `json.loads` gives
a float `10.0` and `str(10.0) == "10.0"`, but JS's `JSON.parse` gives the
number `10` (JS has no int/float distinction) and `String(10) == "10"` -- a
correct-in-spirit TS port would hash differently purely from JSON's number
model, not from a real bug. String-typed amounts (`"10.0"` vs `"10.00"`) and
bare integers (`10`) do NOT have this problem and are asserted normally. To
remove any ambiguity on the fallback path anyway, every no-id case in
`idempotency_hash.json` also carries an `expected.hash_input` field: the
exact pre-SHA-256 string. A TS port can hash that string directly and
compare, sidestepping the need to reproduce Python's `str()` formatting.

## What is pinned, by function

| Surface | Function (import path) | Fixture file |
|---|---|---|
| Idempotency hashing, amount->cents rounding, field extraction, `stable_json` serialization (`raw_json`) | `youinc_ledger.models.RawTransaction.from_akahu_payload`, `youinc_ledger.models.stable_json` | `fixtures/idempotency_hash.json` |
| Classification rule priority + insertion-order (seq) tiebreak, nzfcc fallback, suspense fallback | `youinc_ledger.rules_router.rules.RulesRouter.route` | `fixtures/rules_routing.json` |
| Source-account -> ledger-account mapping, unmapped-account-id sanitization | `youinc_ledger.rules_router.rules.RulesRouter.account_mapping_for` | `fixtures/account_mapping.json` |
| Double-entry balancing, sign->debit/credit convention, manual-classification override precedence, duplicate/pending/zero-amount handling, `PipelineResult` counters | `youinc_ledger.ledger_pipeline.pipeline.LedgerPipeline.process_payloads` (+ `youinc_ledger.models.JournalTransaction.validate_balanced`) | `fixtures/journal_balancing.json` |
| Sync cursor key format and advancement logic | `youinc_ledger.cli.cmd_sync` (`last_sync:{account_id}` via `youinc_ledger.persistence_layer.db.LedgerDatabase.get_sync_state`/`set_sync_state`) | `fixtures/sync_state.json` + `fixtures/sync_state_mock_batch1.json` |
| Read-DAL: balances (debit-positive signed sum, grouped by account+currency), income statement (credit-positive, `Income:`/`Expenses:` only, by month), journal rows (one row per posting, `transaction_date`/insertion order), and hledger export text formatting | `youinc_ledger.persistence_layer.db.LedgerDatabase.fetch_balances`/`fetch_income_statement`/`fetch_journal_rows`, `youinc_ledger.persistence_layer.ledger_exporter.export_hledger` | `fixtures/read_model.json` |

Runner: `test_golden_fixtures.py` (pytest). It imports the real engine,
re-derives outputs from each fixture's `input`, and asserts equality against
the fixture's `expected` block. It currently asserts against the **live**
`RulesRouter`/pipeline running against `fixtures/rules_snapshot.yaml`, not
against `config/rules.yaml` directly -- see below.

## Why a frozen rules snapshot

`config/rules.yaml` is the owner's live, evolving personal ruleset -- it will
keep changing for ordinary accounting reasons (new merchants, new accounts)
that have nothing to do with the TS port. If the golden tests read
`config/rules.yaml` directly, they would spuriously fail on every future rule
edit. Instead, `fixtures/rules_snapshot.yaml` is a frozen copy of
`config/rules.yaml` taken at capture time. All routing/balancing fixtures
were generated against this frozen copy and must continue to be evaluated
against it. When the TS port is built, it should be tested against the
*same* `rules_snapshot.yaml` file (verbatim, checked in here) for parity; the
live production `config/rules.yaml` is a separate, evolving artifact outside
the scope of this contract.

## Real data used, and where it came from

The original Python engine's SQLite ledger (captured 2026-07-04, 170
`raw_transactions`, 173 `journal_transactions`) served as the primary corpus
for `idempotency_hash.json`, `rules_routing.json`, `account_mapping.json`, and
the `real_batch_diverse_sample` case in `journal_balancing.json`. Samples
were chosen to spread across every distinct transaction `status` present
(EFTPOS, ATM, PAYMENT, DIRECT DEBIT, CREDIT, TRANSFER, DIRECT CREDIT,
STANDING ORDER), the smallest and largest `|amount_cents|`, and an even
spread across the remaining rows.

**PII scrub applied before writing fixtures to git**: `data/` is
gitignored and contains real bank account numbers (`meta.other_account`),
card suffixes, and running balances. Fixtures only whitelist the exact
fields `RawTransaction.from_akahu_payload` reads (`_id`, `_account`, `date`,
`settlement_date`, `amount`, `currency`, `description`, `merchant.name`,
`category.nzfcc`/`code`, `status`/`type`) -- everything else (account
numbers, card suffixes, balances, connection ids) is stripped. This does not
change engine behavior since those fields are never read by the pinned
functions.

Existing repo fixtures (`tests/fixtures/akahu_transactions.json`, itself
synthetic/example data, not real) and the CLI's `sync --mock-file` path were
reviewed and are exercised as-is by the pre-existing pytest suite; the golden
sync-state fixtures build a dedicated small mock batch
(`fixtures/sync_state_mock_batch1.json`) instead of reusing that file, so the
sync-state contract has its own isolated fixture.

## Where synthetic cases were required (real corpus gaps)

The real corpus turned out to have zero coverage of several priority-surface
edge cases, so synthetic cases were added on top (each tagged
`"source": "synthetic"` in its fixture entry, never replacing a real case):

- **No transaction ever lacks an `_id`.** Real Akahu payloads always carry
  `_id`, so the hash fallback path (`account_id|date|amount|description|
  merchant` joined with `|`, no akahu id) is entirely synthetic here. This is
  the path where amount-string formatting differences (`"10.0"` vs `"10.00"`)
  actually change the hash -- see the hard gate above.
- **No zero-amount rows** exist in the real DB (170/170 non-zero). Zero-amount
  skip behavior is synthetic.
- **100% ASCII** merchant names and descriptions in the real DB. Unicode
  (macrons, emoji) cases are synthetic.
- **No rows trigger `ROUND_HALF_UP`'s divergence from Python's default
  rounding** (real amounts are all already 2-decimal-clean). The `10.005` /
  `-10.005` cases are synthetic.
- **No two rules in `config/rules.yaml` share a priority AND match the same
  real transaction**, so the priority-then-declaration-order (seq) tiebreak
  is proven with a small synthetic `router_config` (see
  `synthetic_priority_tiebreak_insertion_order` and
  `synthetic_priority_lower_number_wins_over_insertion_order` in
  `rules_routing.json`).
- **No manual classification override, duplicate-payload, or missing-field
  error case** naturally recurs across a single fresh pipeline run from an
  empty DB, so those are synthetic in `journal_balancing.json` /
  `idempotency_hash.json`.

## A behavioral gap discovered during capture (pinned, not fixed)

`youinc_ledger.models.extract_nzfcc` reads `raw["category"]["nzfcc"]` or
`raw["category"]["code"]`. **Real Akahu category payloads never have either
key** -- the actual shape is `{"_id": ..., "name": ..., "groups": {...}}`.
As a result, **`RawTransaction.nzfcc` is `None` for all 170 real transactions
in the DB**, and the `nzfcc_mappings` block in `rules.yaml` is currently dead
code against live data; every real transaction is routed by regex rules or
falls through to suspense, never by nzfcc. This is captured as-is
(`synthetic_category_real_shape_no_nzfcc` vs.
`synthetic_category_expected_shape_has_nzfcc` in `idempotency_hash.json`,
and reflected throughout `rules_routing.json`). The TS port must reproduce
this gap exactly (nzfcc extraction returns `None` for the real Akahu shape)
unless a follow-up ticket explicitly decides to fix it in both languages
simultaneously with its own parity fixtures.

## Coverage gaps / not pinned here

- **`ledger_exporter.py` (hledger export)** and the read-DAL query methods
  (`fetch_balances`/`fetch_income_statement`/`fetch_journal_rows`) are **now
  pinned** in `fixtures/read_model.json` (added after the Phase 0.5 baseline;
  captured via `generate_read_model_fixture.py`, which replays the
  `journal_balancing` corpus through the pipeline and reads the four surfaces
  back out). The TS port proves parity in
  `frontend/src/server/ledger-engine/readModel.golden.test.ts`.
- **`bi_reporting/dashboard.py`** (Streamlit UI), **`rules_editor.py`**'s
  YAML-file-mutation formatting, and **`akahu_client.py`**'s live HTTP behavior
  (pagination, rate limiting, auth) remain out of scope for this phase -- they
  are not in the "silent divergence risk" list and are not pure functions in
  the same sense.
- **`reclassify_existing_journals`** (bulk rebuild path) is not separately
  pinned; it shares `_build_journal_transaction` with `process_payloads`,
  which is fully covered.
- The pre-existing `manual:opening_balance` `rule_id` values visible in the
  live DB's `journal_transactions.rule_id` column are **not** reproducible
  via any current code path (the pipeline only ever writes `rule_id` values
  that come from `RulesRouter.route()` or the literal `"manual:override"`);
  they are an artifact of an earlier manual DB migration/seed and are
  intentionally excluded from the fixtures.

## Running the baseline

```bash
cd /Users/hamish/Documents/Personal/YouInc
source .venv/bin/activate
python -m pytest tests/golden/ -q
```

Result at capture time: **99 passed** (28 real + 19 synthetic idempotency
cases, 30 real + 5 synthetic routing cases, 6 real + 2 synthetic
account-mapping cases, 1 real + 5 synthetic journal-balancing batch cases, 3
synthetic sync-state cases -- some fixture files contain multiple assertions
per pytest case, e.g. every posting in a batch is separately balance-checked).

Note: running the full `tests/` suite (`python -m pytest tests/ -q`) shows
one **pre-existing, unrelated** failure --
`tests/test_classify.py::test_classify_starts_in_suspense` -- caused by a
`manual_sals_pizza_cuba_st` rule that was added to `config/rules.yaml` after
that test was written (verified present on a clean stash of this work). It
does not touch anything under `tests/golden/` and was not introduced by this
work.

## Fixture format (language-agnostic, for the TS port to consume directly)

Every fixture file is `{"cases": [ ... ]}`. Each case is a plain-JSON object
with no language-specific types (no tuples, no Decimal -- amounts are always
either an integer cents count or the original JSON-native amount
representation from the simulated Akahu payload):

```jsonc
{
  "case_id": "real_0094",        // stable, human-readable, unique per file
  "source": "real" | "synthetic",// "real" = derived from data/youinc-ledger.sqlite3
  "note": "optional human explanation, always present on synthetic cases",
  "input": { /* plain JSON: an Akahu-shaped payload, or a routing/pipeline input */ },
  "router_config": { /* only present when a case needs a bespoke RulesRouter config
                         instead of rules_snapshot.yaml, e.g. the seq tiebreak cases */ },
  "expect_error": false,          // idempotency_hash.json only: true means `input`
  "error_contains": "...",        // must raise a validation error containing this substring
  "expected": { /* plain JSON: the exact fields the pinned function returns */ }
}
```

For a TS test runner to reuse these fixtures as-is:

- Load each `fixtures/*.json` file, iterate `cases`, treat `case_id`+`source`
  as the test name.
- For `idempotency_hash.json`: build the TS equivalent of an Akahu payload
  from `input`, run it through the TS `fromAkahuPayload`-equivalent, and
  assert every key in `expected` matches -- `idempotency_hash` equality is
  non-negotiable (see hard gate above); the other fields are strong parity
  signal but not the hard gate.
- For `rules_routing.json` / `account_mapping.json`: construct a `RulesRouter`
  equivalent from `router_config` if present, else from
  `fixtures/rules_snapshot.yaml`, and assert `expected` matches the route
  decision / account mapping.
- For `journal_balancing.json`: replay `input.payloads` (and
  `input.manual_classifications` if present) through the TS pipeline
  equivalent against `rules_snapshot.yaml`, and assert the resulting
  `PipelineResult` counters and journal transactions/postings match
  `expected` exactly, including posting order (`transaction_date`, then
  insertion order, then posting insertion order) and that every journal's
  debit total equals its credit total.
- For `sync_state.json`: assert the sync cursor key is exactly
  `` `last_sync:${accountId}` `` and that the stored value after a sync run
  matches `expected.sync_state_value` for the same mock batch
  (`fixtures/sync_state_mock_batch1.json`) and `end_date` handling.
