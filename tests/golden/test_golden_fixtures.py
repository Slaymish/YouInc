"""Phase 0.5 golden characterization tests for youinc_ledger.

These tests pin the CURRENT Python engine's exact behavior so a future
TypeScript port can be proven at parity against the same JSON fixtures
under tests/golden/fixtures/. See tests/golden/README.md for the full
parity contract.

Do not "fix" surprising behavior here -- these tests intentionally capture
what the engine does today, including known quirks (see README "Known
gaps / quirks pinned as-is").
"""
from __future__ import annotations

import json
import tempfile
import argparse
from pathlib import Path

import pytest

from read_model_support import capture_read_model
from youinc_ledger.cli import cmd_sync
from youinc_ledger.ledger_pipeline.pipeline import LedgerPipeline
from youinc_ledger.models import RawTransaction
from youinc_ledger.persistence_layer.db import LedgerDatabase
from youinc_ledger.rules_router.rules import RulesRouter

FIXTURES = Path(__file__).parent / "fixtures"
RULES_SNAPSHOT = FIXTURES / "rules_snapshot.yaml"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _case_id(case: dict) -> str:
    return f"{case.get('source', '?')}:{case['case_id']}"


# ---------------------------------------------------------------------------
# 1. idempotency_hash -- THE HARD P2 ACCEPTANCE GATE
# ---------------------------------------------------------------------------

IDEMPOTENCY_CASES = _load("idempotency_hash.json")["cases"]


@pytest.mark.parametrize("case", IDEMPOTENCY_CASES, ids=_case_id)
def test_idempotency_hash_golden(case: dict) -> None:
    """Pins RawTransaction.from_akahu_payload (youinc_ledger.models).

    This is the HARD cross-language acceptance gate: a TS port MUST produce
    byte-identical idempotency_hash values for every case in
    fixtures/idempotency_hash.json, including the synthetic edge cases for
    trailing-zero amount strings, unicode, missing fields, and rounding.
    """
    if case.get("expect_error"):
        with pytest.raises(ValueError) as exc_info:
            RawTransaction.from_akahu_payload(case["input"])
        if case.get("error_contains"):
            assert case["error_contains"] in str(exc_info.value)
        return

    txn = RawTransaction.from_akahu_payload(case["input"])
    expected = case["expected"]
    assert txn.idempotency_hash == expected["idempotency_hash"]
    assert txn.amount_cents == expected["amount_cents"]
    assert txn.account_id == expected["account_id"]
    assert txn.status == expected["status"]
    assert txn.transaction_date == expected["transaction_date"]
    assert txn.settlement_date == expected["settlement_date"]
    assert txn.description == expected["description"]
    assert txn.merchant_name == expected["merchant_name"]
    assert txn.nzfcc == expected["nzfcc"]
    assert txn.currency == expected["currency"]
    assert txn.is_pending == expected["is_pending"]
    # Pins youinc_ledger.models.stable_json (sort_keys=True, separators=(",",":"),
    # ensure_ascii=False) -- priority surface #1's serializer, independent of hashing.
    assert txn.raw_json == expected["raw_json"]

    # For the no-akahu-id fallback hash path, the fixture also carries the
    # exact pre-SHA input string so a TS port doesn't have to reverse-engineer
    # Python's str() formatting -- it can hash this string directly and compare.
    if "hash_input" in expected:
        import hashlib

        assert hashlib.sha256(expected["hash_input"].encode("utf-8")).hexdigest() == expected["idempotency_hash"]


# ---------------------------------------------------------------------------
# 2. rules routing / classification-rule priority + insertion order
# ---------------------------------------------------------------------------

ROUTING_CASES = _load("rules_routing.json")["cases"]
_DEFAULT_ROUTER = RulesRouter.from_file(RULES_SNAPSHOT)


@pytest.mark.parametrize("case", ROUTING_CASES, ids=_case_id)
def test_rules_routing_golden(case: dict) -> None:
    """Pins RulesRouter.route (youinc_ledger.rules_router.rules), including
    the priority-then-declaration-order (seq) tiebreak."""
    router = (
        RulesRouter(case["router_config"]) if "router_config" in case else _DEFAULT_ROUTER
    )
    txn = RawTransaction.from_akahu_payload(case["input"])
    decision = router.route(txn)
    expected = case["expected"]
    assert decision.target_account == expected["target_account"]
    assert decision.rule_id == expected["rule_id"]
    assert decision.matched_by == expected["matched_by"]
    assert decision.memo == expected["memo"]


# ---------------------------------------------------------------------------
# 3. account mapping (sync-account -> ledger account, incl. unmapped fallback)
# ---------------------------------------------------------------------------

ACCOUNT_MAPPING_CASES = _load("account_mapping.json")["cases"]


@pytest.mark.parametrize("case", ACCOUNT_MAPPING_CASES, ids=_case_id)
def test_account_mapping_golden(case: dict) -> None:
    """Pins RulesRouter.account_mapping_for, including unmapped-account-id
    sanitization (non [A-Za-z0-9_:-] chars -> '_')."""
    mapping = _DEFAULT_ROUTER.account_mapping_for(case["input"]["account_id"])
    expected = case["expected"]
    assert mapping.ledger_account == expected["ledger_account"]
    assert mapping.account_type == expected["account_type"]
    assert mapping.credit_limit_cents == expected["credit_limit_cents"]


# ---------------------------------------------------------------------------
# 4. double-entry balancing + sign convention + manual overrides + dedup
# ---------------------------------------------------------------------------

BALANCING_CASES = _load("journal_balancing.json")["cases"]


def _run_pipeline(case: dict) -> dict:
    payloads = case["input"]["payloads"]
    manual = case["input"].get("manual_classifications", [])
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "ledger.sqlite3"
        database = LedgerDatabase(db_path)
        database.init_schema()
        for entry in manual:
            database.set_manual_classification(
                entry["external_id"], entry["target_account"], entry.get("memo")
            )
        router = RulesRouter.from_file(RULES_SNAPSHOT)
        pipeline = LedgerPipeline(database, router, discard_pending=True)
        result = pipeline.process_payloads(payloads)

        with database.connect() as connection:
            rows = connection.execute(
                """
                SELECT jt.external_id, jt.transaction_date, jt.description,
                       jt.source_account_id, jt.status, jt.rule_id,
                       je.account, je.side, je.amount_cents, je.currency
                FROM journal_transactions jt
                JOIN journal_entries je ON je.journal_transaction_id = jt.id
                ORDER BY jt.transaction_date, jt.id, je.id
                """
            ).fetchall()

        journals: dict[str, dict] = {}
        for row in rows:
            jid = row["external_id"]
            entry = journals.setdefault(jid, {
                "external_id": jid,
                "transaction_date": row["transaction_date"],
                "description": row["description"],
                "source_account_id": row["source_account_id"],
                "status": row["status"],
                "rule_id": row["rule_id"],
                "postings": [],
            })
            entry["postings"].append({
                "account": row["account"], "side": row["side"],
                "amount_cents": row["amount_cents"], "currency": row["currency"],
            })

        return {
            "result": {
                "seen": result.seen,
                "raw_inserted": result.raw_inserted,
                "posted": result.posted,
                "skipped_pending": result.skipped_pending,
                "skipped_duplicate": result.skipped_duplicate,
                "skipped_zero_amount": result.skipped_zero_amount,
                "errors": list(result.errors),
            },
            "journal_transactions": list(journals.values()),
        }


@pytest.mark.parametrize("case", BALANCING_CASES, ids=_case_id)
def test_journal_balancing_golden(case: dict) -> None:
    """Pins LedgerPipeline.process_payloads end to end: PipelineResult
    counters, debit/credit sign convention, manual-override precedence,
    duplicate/pending/zero-amount handling, and that every posted journal
    transaction balances (sum debits == sum credits)."""
    outcome = _run_pipeline(case)
    assert outcome == case["expected"]

    for jt in outcome["journal_transactions"]:
        debit_total = sum(p["amount_cents"] for p in jt["postings"] if p["side"] == "debit")
        credit_total = sum(p["amount_cents"] for p in jt["postings"] if p["side"] == "credit")
        assert debit_total == credit_total, f"unbalanced journal: {jt['external_id']}"
        assert debit_total > 0, f"non-positive journal total: {jt['external_id']}"


# ---------------------------------------------------------------------------
# 5. read-DAL: balances / income statement / journal rows / hledger export
# ---------------------------------------------------------------------------

READ_MODEL_CASES = _load("read_model.json")["cases"]


@pytest.mark.parametrize("case", READ_MODEL_CASES, ids=_case_id)
def test_read_model_golden(case: dict) -> None:
    """Pins the read side of LedgerDatabase over the journal_balancing corpus:
    fetch_balances (debit-positive signed sum, grouped by account+currency),
    fetch_income_statement (credit-positive, Income:/Expenses: only, by month),
    fetch_journal_rows (one row per posting in transaction_date/insertion
    order), and ledger_exporter.export_hledger's exact text formatting. These
    were previously listed as "not pinned" in README.md and are the read-model
    parity contract for the TypeScript port."""
    outcome = capture_read_model(case["input"])
    assert outcome == case["expected"]


# ---------------------------------------------------------------------------
# 6. sync-state cursor (last_sync:{account_id})
# ---------------------------------------------------------------------------

SYNC_STATE_FIXTURE = _load("sync_state.json")
SYNC_MOCK_BATCH_1 = FIXTURES / "sync_state_mock_batch1.json"


def test_sync_state_key_format() -> None:
    case = next(c for c in SYNC_STATE_FIXTURE["cases"] if c["case_id"] == "sync_key_format")
    assert case["expected"]["key"] == "last_sync:acc_sync_example"


def test_sync_state_marker_defaults_to_latest_payload_date() -> None:
    case = next(
        c for c in SYNC_STATE_FIXTURE["cases"]
        if c["case_id"] == "sync_marker_defaults_to_latest_payload_settlement_or_date"
    )
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "ledger.sqlite3"
        args = argparse.Namespace(
            db_path=db_path,
            rules_path=RULES_SNAPSHOT,
            mock_file=SYNC_MOCK_BATCH_1,
            account_id=case["input"]["account_id"],
            start_date=None,
            end_date=case["input"]["end_date"],
            delta=False,
        )
        exit_code = cmd_sync(args)
        database = LedgerDatabase(db_path)
        value = database.get_sync_state(f"last_sync:{case['input']['account_id']}")

    assert exit_code == case["expected"]["exit_code"]
    assert value == case["expected"]["sync_state_value"]


def test_sync_state_marker_prefers_explicit_end_date() -> None:
    case = next(
        c for c in SYNC_STATE_FIXTURE["cases"]
        if c["case_id"] == "sync_marker_prefers_explicit_end_date"
    )
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "ledger.sqlite3"
        mock_file = Path(tmp) / "batch2.json"
        mock_file.write_text(json.dumps(case["input"]["payloads"]), encoding="utf-8")

        # Seed the cursor with batch 1 first, mirroring the generator's two-sync sequence.
        seed_args = argparse.Namespace(
            db_path=db_path,
            rules_path=RULES_SNAPSHOT,
            mock_file=SYNC_MOCK_BATCH_1,
            account_id=case["input"]["account_id"],
            start_date=None,
            end_date=None,
            delta=False,
        )
        cmd_sync(seed_args)

        args = argparse.Namespace(
            db_path=db_path,
            rules_path=RULES_SNAPSHOT,
            mock_file=mock_file,
            account_id=case["input"]["account_id"],
            start_date=None,
            end_date=case["input"]["end_date"],
            delta=False,
        )
        exit_code = cmd_sync(args)
        database = LedgerDatabase(db_path)
        value = database.get_sync_state(f"last_sync:{case['input']['account_id']}")

    assert exit_code == case["expected"]["exit_code"]
    assert value == case["expected"]["sync_state_value"]
