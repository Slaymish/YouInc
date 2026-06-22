from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from youinc_ledger.models import JournalTransaction, RawTransaction, utc_now_iso

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS raw_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    akahu_transaction_id TEXT,
    idempotency_hash TEXT NOT NULL UNIQUE,
    account_id TEXT NOT NULL,
    status TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NZD',
    transaction_date TEXT NOT NULL,
    settlement_date TEXT,
    description TEXT NOT NULL,
    merchant_name TEXT,
    nzfcc TEXT,
    raw_json TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    processed_at TEXT,
    skipped_reason TEXT,
    UNIQUE(akahu_transaction_id)
);

CREATE TABLE IF NOT EXISTS journal_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT NOT NULL UNIQUE,
    transaction_date TEXT NOT NULL,
    description TEXT NOT NULL,
    source_account_id TEXT NOT NULL,
    status TEXT NOT NULL,
    rule_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_transaction_id INTEGER NOT NULL REFERENCES journal_transactions(id) ON DELETE CASCADE,
    account TEXT NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('debit', 'credit')),
    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'NZD'
);

CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_transactions_account_date
    ON raw_transactions(account_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_journal_transactions_date
    ON journal_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_account
    ON journal_entries(account);
"""


class LedgerDatabase:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        if self.path.parent != Path("."):
            self.path.parent.mkdir(parents=True, exist_ok=True)

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def init_schema(self) -> None:
        with self.connect() as connection:
            connection.executescript(SCHEMA_SQL)

    def upsert_raw_transaction(self, transaction: RawTransaction) -> bool:
        now = utc_now_iso()
        with self.connect() as connection:
            existing = connection.execute(
                "SELECT id FROM raw_transactions WHERE idempotency_hash = ?",
                (transaction.idempotency_hash,),
            ).fetchone()
            connection.execute(
                """
                INSERT INTO raw_transactions (
                    akahu_transaction_id, idempotency_hash, account_id, status, amount_cents,
                    currency, transaction_date, settlement_date, description, merchant_name,
                    nzfcc, raw_json, first_seen_at, last_seen_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(idempotency_hash) DO UPDATE SET
                    status = excluded.status,
                    amount_cents = excluded.amount_cents,
                    currency = excluded.currency,
                    transaction_date = excluded.transaction_date,
                    settlement_date = excluded.settlement_date,
                    description = excluded.description,
                    merchant_name = excluded.merchant_name,
                    nzfcc = excluded.nzfcc,
                    raw_json = excluded.raw_json,
                    last_seen_at = excluded.last_seen_at
                """,
                (
                    transaction.akahu_transaction_id,
                    transaction.idempotency_hash,
                    transaction.account_id,
                    transaction.status,
                    transaction.amount_cents,
                    transaction.currency,
                    transaction.transaction_date,
                    transaction.settlement_date,
                    transaction.description,
                    transaction.merchant_name,
                    transaction.nzfcc,
                    transaction.raw_json,
                    now,
                    now,
                ),
            )
            return existing is None

    def mark_raw_processed(self, external_id: str) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                UPDATE raw_transactions
                SET processed_at = ?, skipped_reason = NULL
                WHERE idempotency_hash = ?
                """,
                (utc_now_iso(), external_id),
            )

    def mark_raw_skipped(self, external_id: str, reason: str) -> None:
        with self.connect() as connection:
            connection.execute(
                "UPDATE raw_transactions SET skipped_reason = ? WHERE idempotency_hash = ?",
                (reason, external_id),
            )

    def journal_exists(self, external_id: str) -> bool:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT 1 FROM journal_transactions WHERE external_id = ?",
                (external_id,),
            ).fetchone()
        return row is not None

    def _insert_journal_transaction(
        self, connection: sqlite3.Connection, transaction: JournalTransaction
    ) -> None:
        cursor = connection.execute(
            """
            INSERT INTO journal_transactions (
                external_id, transaction_date, description, source_account_id,
                status, rule_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                transaction.external_id,
                transaction.transaction_date,
                transaction.description,
                transaction.source_account_id,
                transaction.status,
                transaction.rule_id,
                utc_now_iso(),
            ),
        )
        if cursor.lastrowid is None:
            raise RuntimeError("SQLite did not return a journal transaction id")
        journal_id = int(cursor.lastrowid)
        connection.executemany(
            """
            INSERT INTO journal_entries (
                journal_transaction_id, account, side, amount_cents, currency
            ) VALUES (?, ?, ?, ?, ?)
            """,
            [
                (journal_id, p.account, p.side, p.amount_cents, p.currency)
                for p in transaction.postings
            ],
        )
        connection.execute(
            """
            UPDATE raw_transactions
            SET processed_at = ?, skipped_reason = NULL
            WHERE idempotency_hash = ?
            """,
            (utc_now_iso(), transaction.external_id),
        )

    def insert_journal_transaction(self, transaction: JournalTransaction) -> bool:
        transaction.validate_balanced()
        if self.journal_exists(transaction.external_id):
            return False

        with self.connect() as connection:
            self._insert_journal_transaction(connection, transaction)
            return True

    def replace_journal_transaction(self, transaction: JournalTransaction) -> None:
        transaction.validate_balanced()
        with self.connect() as connection:
            connection.execute(
                "DELETE FROM journal_transactions WHERE external_id = ?",
                (transaction.external_id,),
            )
            self._insert_journal_transaction(connection, transaction)

    def fetch_journaled_raw_transactions(self) -> list[RawTransaction]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT rt.*
                FROM raw_transactions rt
                JOIN journal_transactions jt ON jt.external_id = rt.idempotency_hash
                ORDER BY rt.transaction_date, rt.id
                """
            ).fetchall()
        return [
            RawTransaction(
                idempotency_hash=str(row["idempotency_hash"]),
                akahu_transaction_id=row["akahu_transaction_id"],
                account_id=str(row["account_id"]),
                status=str(row["status"]),
                amount_cents=int(row["amount_cents"]),
                currency=str(row["currency"]),
                transaction_date=str(row["transaction_date"]),
                settlement_date=row["settlement_date"],
                description=str(row["description"]),
                merchant_name=row["merchant_name"],
                nzfcc=row["nzfcc"],
                raw_json=str(row["raw_json"]),
            )
            for row in rows
        ]

    def get_sync_state(self, key: str) -> str | None:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT value FROM sync_state WHERE key = ?", (key,)
            ).fetchone()
        return str(row["value"]) if row else None

    def set_sync_state(self, key: str, value: str) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO sync_state(key, value, updated_at) VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """,
                (key, value, utc_now_iso()),
            )

    def fetch_balances(self) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    account,
                    SUM(CASE WHEN side = 'debit' THEN amount_cents ELSE -amount_cents END) AS balance_cents,
                    currency
                FROM journal_entries
                GROUP BY account, currency
                ORDER BY account
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def fetch_income_statement(self) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    substr(jt.transaction_date, 1, 7) AS month,
                    je.account,
                    SUM(CASE WHEN je.side = 'credit' THEN je.amount_cents ELSE -je.amount_cents END) AS amount_cents,
                    je.currency
                FROM journal_entries je
                JOIN journal_transactions jt ON jt.id = je.journal_transaction_id
                WHERE je.account LIKE 'Income:%' OR je.account LIKE 'Expenses:%'
                GROUP BY month, je.account, je.currency
                ORDER BY month, je.account
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def fetch_journal_rows(self) -> list[sqlite3.Row]:
        with self.connect() as connection:
            return connection.execute(
                """
                SELECT
                    jt.external_id,
                    jt.transaction_date,
                    jt.description,
                    jt.rule_id,
                    je.account,
                    je.side,
                    je.amount_cents,
                    je.currency
                FROM journal_transactions jt
                JOIN journal_entries je ON je.journal_transaction_id = jt.id
                ORDER BY jt.transaction_date, jt.id, je.id
                """
            ).fetchall()
