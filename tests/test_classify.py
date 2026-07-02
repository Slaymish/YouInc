from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from youinc_ledger.cli import cmd_classify, cmd_map_account, cmd_set_balance
from youinc_ledger.ledger_pipeline.pipeline import LedgerPipeline
from youinc_ledger.models import RawTransaction
from youinc_ledger.persistence_layer.db import LedgerDatabase
from youinc_ledger.rules_router.rules import RulesRouter

SUSPENSE_ACCOUNT = "Expenses:Uncategorized:Suspense"
TARGET = "Expenses:OpEx:MealsAndProvisions"

PARKED_PAYLOAD = {
    "_id": "txn_mystery_001",
    "_account": "acc_bnz_cash_example",
    "status": "SETTLED",
    "date": "2026-06-22",
    "settlement_date": "2026-06-22",
    "amount": -16.32,
    "currency": "NZD",
    "description": "SALS PIZZA CUBA ST",
}


def _rules_copy(tmp_path: Path) -> Path:
    target = tmp_path / "rules.yaml"
    shutil.copy("config/rules.yaml", target)
    return target


def _seed_parked_journal(tmp_path: Path, rules_path: Path) -> tuple[LedgerDatabase, str]:
    database = LedgerDatabase(tmp_path / "ledger.sqlite3")
    database.init_schema()
    pipeline = LedgerPipeline(database, RulesRouter.from_file(rules_path), discard_pending=True)
    pipeline.process_payloads([PARKED_PAYLOAD])
    external_id = RawTransaction.from_akahu_payload(PARKED_PAYLOAD).idempotency_hash
    return database, external_id


def _journal_target(database: LedgerDatabase, external_id: str) -> str:
    with database.connect() as connection:
        row = connection.execute(
            """
            SELECT je.account
            FROM journal_transactions jt
            JOIN journal_entries je ON je.journal_transaction_id = jt.id
            WHERE jt.external_id = ? AND je.side = 'debit'
            """,
            (external_id,),
        ).fetchone()
    return str(row["account"]) if row else ""


def _classify_args(
    tmp_path: Path, rules_path: Path, external_id: str, **overrides
) -> argparse.Namespace:
    defaults = dict(
        db_path=tmp_path / "ledger.sqlite3",
        rules_path=rules_path,
        external_id=external_id,
        target_account=TARGET,
        mode="rule",
        pattern=None,
        memo=None,
        json=False,
    )
    defaults.update(overrides)
    return argparse.Namespace(**defaults)


def test_classify_starts_in_suspense(tmp_path: Path) -> None:
    rules_path = _rules_copy(tmp_path)
    database, external_id = _seed_parked_journal(tmp_path, rules_path)
    assert _journal_target(database, external_id) == SUSPENSE_ACCOUNT


def test_classify_rule_mode_appends_rule_and_reroutes(tmp_path: Path) -> None:
    rules_path = _rules_copy(tmp_path)
    _, external_id = _seed_parked_journal(tmp_path, rules_path)

    exit_code = cmd_classify(_classify_args(tmp_path, rules_path, external_id))

    assert exit_code == 0
    database = LedgerDatabase(tmp_path / "ledger.sqlite3")
    assert _journal_target(database, external_id) == TARGET

    rules_text = rules_path.read_text(encoding="utf-8")
    assert "manual_sals_pizza_cuba_st" in rules_text
    # Curated comments must survive the textual edit.
    assert "Balance-sheet transfers and treasury allocation first." in rules_text

    # Re-running with the same merchant pattern still routes (rule persists).
    second = _seed_parked_journal(tmp_path, rules_path)[0]
    second_router = RulesRouter.from_file(rules_path)
    decision = second_router.route(RawTransaction.from_akahu_payload(PARKED_PAYLOAD))
    assert decision.target_account == TARGET


def test_classify_once_mode_overrides_single_transaction(tmp_path: Path) -> None:
    rules_path = _rules_copy(tmp_path)
    database, external_id = _seed_parked_journal(tmp_path, rules_path)
    before = rules_path.read_text(encoding="utf-8")

    exit_code = cmd_classify(
        _classify_args(tmp_path, rules_path, external_id, mode="once", memo="dinner")
    )

    assert exit_code == 0
    assert rules_path.read_text(encoding="utf-8") == before  # no rule written
    assert database.get_manual_classification(external_id) == (TARGET, "dinner")
    assert _journal_target(LedgerDatabase(tmp_path / "ledger.sqlite3"), external_id) == TARGET


def test_classify_rejects_non_colon_account(tmp_path: Path) -> None:
    rules_path = _rules_copy(tmp_path)
    _, external_id = _seed_parked_journal(tmp_path, rules_path)

    exit_code = cmd_classify(
        _classify_args(tmp_path, rules_path, external_id, target_account="NotAnAccount")
    )

    assert exit_code == 1


def test_classify_unknown_external_id(tmp_path: Path) -> None:
    rules_path = _rules_copy(tmp_path)
    _seed_parked_journal(tmp_path, rules_path)

    exit_code = cmd_classify(_classify_args(tmp_path, rules_path, "does-not-exist"))

    assert exit_code == 1


def test_map_account_upserts_mapping(tmp_path: Path) -> None:
    rules_path = _rules_copy(tmp_path)
    args = argparse.Namespace(
        rules_path=rules_path,
        account_id="acc_new_example",
        ledger_account="Assets:Bank:BNZ:Savings",
        account_type="asset",
        credit_limit_cents=None,
        json=False,
    )

    assert cmd_map_account(args) == 0

    router = RulesRouter.from_file(rules_path)
    mapping = router.account_mapping_for("acc_new_example")
    assert mapping.ledger_account == "Assets:Bank:BNZ:Savings"


def test_map_account_records_credit_limit_for_liability(tmp_path: Path) -> None:
    rules_path = _rules_copy(tmp_path)
    args = argparse.Namespace(
        rules_path=rules_path,
        account_id="acc_credit_card",
        ledger_account="Liabilities:CreditCard:Amex",
        account_type="liability",
        credit_limit_cents=500_000,
        json=False,
    )

    assert cmd_map_account(args) == 0

    router = RulesRouter.from_file(rules_path)
    mapping = router.account_mapping_for("acc_credit_card")
    assert mapping.ledger_account == "Liabilities:CreditCard:Amex"
    assert mapping.account_type == "liability"
    assert mapping.credit_limit_cents == 500_000


def test_set_balance_writes_manual_balance(tmp_path: Path) -> None:
    rules_path = _rules_copy(tmp_path)
    _seed_parked_journal(tmp_path, rules_path)
    args = argparse.Namespace(
        db_path=tmp_path / "ledger.sqlite3",
        account="Assets:Investments:Blossom",
        balance_cents=123456,
        as_of_date=None,
        json=False,
    )

    assert cmd_set_balance(args) == 0

    database = LedgerDatabase(tmp_path / "ledger.sqlite3")
    with database.connect() as connection:
        row = connection.execute(
            "SELECT balance_cents FROM manual_account_balances WHERE account = ?",
            ("Assets:Investments:Blossom",),
        ).fetchone()
    assert int(row["balance_cents"]) == 123456
