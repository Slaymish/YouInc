from __future__ import annotations

import argparse
import json
from pathlib import Path

from youinc_ledger.cli import cmd_sync
from youinc_ledger.ledger_pipeline.pipeline import LedgerPipeline
from youinc_ledger.persistence_layer.db import LedgerDatabase
from youinc_ledger.rules_router.rules import RulesRouter

FIXTURE = Path("tests/fixtures/akahu_transactions.json")


def _database(tmp_path: Path) -> LedgerDatabase:
    database = LedgerDatabase(tmp_path / "ledger.sqlite3")
    database.init_schema()
    return database


def _router() -> RulesRouter:
    return RulesRouter.from_file("config/rules.yaml")


def _payloads() -> list[dict]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def _count(database: LedgerDatabase, table: str) -> int:
    with database.connect() as connection:
        row = connection.execute(f"SELECT COUNT(*) AS count FROM {table}").fetchone()
    return int(row["count"])


def test_pipeline_is_idempotent_over_same_payloads(tmp_path: Path) -> None:
    database = _database(tmp_path)
    pipeline = LedgerPipeline(database, _router(), discard_pending=True)

    first = pipeline.process_payloads(_payloads())
    second = pipeline.process_payloads(_payloads())

    assert first.seen == 4
    assert first.posted == 3
    assert first.skipped_pending == 1
    assert second.posted == 0
    assert second.skipped_duplicate == 3
    assert _count(database, "raw_transactions") == 4
    assert _count(database, "journal_transactions") == 3
    assert _count(database, "journal_entries") == 6


def test_posted_journals_are_balanced(tmp_path: Path) -> None:
    database = _database(tmp_path)
    pipeline = LedgerPipeline(database, _router(), discard_pending=True)

    pipeline.process_payloads(_payloads())

    with database.connect() as connection:
        rows = connection.execute(
            """
            SELECT
                journal_transaction_id,
                SUM(CASE WHEN side = 'debit' THEN amount_cents ELSE 0 END) AS debits,
                SUM(CASE WHEN side = 'credit' THEN amount_cents ELSE 0 END) AS credits
            FROM journal_entries
            GROUP BY journal_transaction_id
            """
        ).fetchall()

    assert rows
    assert all(row["debits"] == row["credits"] for row in rows)


def test_pending_transaction_is_not_posted(tmp_path: Path) -> None:
    database = _database(tmp_path)
    pipeline = LedgerPipeline(database, _router(), discard_pending=True)

    pipeline.process_payloads(_payloads())

    with database.connect() as connection:
        pending = connection.execute(
            """
            SELECT skipped_reason FROM raw_transactions
            WHERE akahu_transaction_id = 'txn_pending_001'
            """
        ).fetchone()
        posted_pending = connection.execute(
            """
            SELECT 1
            FROM journal_transactions jt
            JOIN raw_transactions rt ON rt.idempotency_hash = jt.external_id
            WHERE rt.akahu_transaction_id = 'txn_pending_001'
            """
        ).fetchone()

    assert pending["skipped_reason"] == "pending"
    assert posted_pending is None


def test_sync_records_latest_payload_date_when_end_date_is_omitted(tmp_path: Path) -> None:
    db_path = tmp_path / "ledger.sqlite3"
    args = argparse.Namespace(
        db_path=db_path,
        rules_path=Path("config/rules.yaml"),
        mock_file=FIXTURE,
        account_id="acc_bnz_cash_example",
        start_date=None,
        end_date=None,
        delta=False,
    )

    assert cmd_sync(args) == 0

    database = LedgerDatabase(db_path)
    assert database.get_sync_state("last_sync:acc_bnz_cash_example") == "2026-06-06"
