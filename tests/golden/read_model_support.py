"""Shared read-DAL capture used by both the fixture generator and the golden
pinning test.

The read-DAL is the *read side* of ``LedgerDatabase``:
``fetch_balances``, ``fetch_income_statement``, ``fetch_journal_rows`` and
``ledger_exporter.export_hledger``. These were explicitly left "not pinned" by
the Phase 0.5 capture (see tests/golden/README.md "Coverage gaps"); this module
pins them so the TypeScript read-model port can be proven at parity against the
same JSON fixture (``fixtures/read_model.json``).

``capture_read_model`` replays a ``journal_balancing`` case's payloads through
the *real* Python pipeline into a throwaway SQLite DB, then reads the four
surfaces back out. It is deliberately the same code path the generator and the
pytest both call, so the fixture is a faithful snapshot of the live engine and
the test fails the day the engine's read behavior drifts.
"""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

from youinc_ledger.ledger_pipeline.pipeline import LedgerPipeline
from youinc_ledger.persistence_layer.db import LedgerDatabase
from youinc_ledger.persistence_layer.ledger_exporter import export_hledger
from youinc_ledger.rules_router.rules import RulesRouter

FIXTURES = Path(__file__).parent / "fixtures"
RULES_SNAPSHOT = FIXTURES / "rules_snapshot.yaml"


def capture_read_model(case_input: dict[str, Any]) -> dict[str, Any]:
    """Materialise ``case_input`` into a fresh ledger and read the read-DAL back.

    Returns the exact plain-JSON ``expected`` block the fixture pins and the TS
    port must reproduce: ``balances``, ``income_statement``, ``journal_rows``
    (one row per posting, in ``fetch_journal_rows`` order) and the full
    ``hledger`` export string.
    """
    payloads = case_input["payloads"]
    manual = case_input.get("manual_classifications", [])
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        db_path = tmp_dir / "ledger.sqlite3"
        database = LedgerDatabase(db_path)
        database.init_schema()
        for entry in manual:
            database.set_manual_classification(
                entry["external_id"], entry["target_account"], entry.get("memo")
            )
        router = RulesRouter.from_file(RULES_SNAPSHOT)
        pipeline = LedgerPipeline(database, router, discard_pending=True)
        pipeline.process_payloads(payloads)

        balances = database.fetch_balances()
        income_statement = database.fetch_income_statement()
        journal_rows = [dict(row) for row in database.fetch_journal_rows()]

        hledger_path = tmp_dir / "export.journal"
        export_hledger(database, hledger_path)
        hledger = hledger_path.read_text(encoding="utf-8")

    return {
        "balances": balances,
        "income_statement": income_statement,
        "journal_rows": journal_rows,
        "hledger": hledger,
    }
