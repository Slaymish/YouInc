from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from youinc_ledger.models import JournalTransaction, Posting, RawTransaction
from youinc_ledger.persistence_layer.db import LedgerDatabase
from youinc_ledger.rules_router.rules import RouteDecision, RulesRouter


@dataclass(frozen=True)
class PipelineResult:
    seen: int = 0
    raw_inserted: int = 0
    posted: int = 0
    skipped_pending: int = 0
    skipped_duplicate: int = 0
    skipped_zero_amount: int = 0
    errors: tuple[str, ...] = ()

    def add_error(self, error: str) -> "PipelineResult":
        return PipelineResult(
            seen=self.seen,
            raw_inserted=self.raw_inserted,
            posted=self.posted,
            skipped_pending=self.skipped_pending,
            skipped_duplicate=self.skipped_duplicate,
            skipped_zero_amount=self.skipped_zero_amount,
            errors=(*self.errors, error),
        )


class LedgerPipeline:
    def __init__(
        self,
        database: LedgerDatabase,
        router: RulesRouter,
        discard_pending: bool = True,
    ) -> None:
        self.database = database
        self.router = router
        self.discard_pending = discard_pending

    def reclassify_existing_journals(self) -> PipelineResult:
        result = PipelineResult()
        for transaction in self.database.fetch_journaled_raw_transactions():
            result = self._replace(result, seen=result.seen + 1)
            try:
                if transaction.amount_cents == 0:
                    result = self._replace(
                        result, skipped_zero_amount=result.skipped_zero_amount + 1
                    )
                    continue
                journal_transaction = self._build_journal_transaction(transaction)
                self.database.replace_journal_transaction(journal_transaction)
                result = self._replace(result, posted=result.posted + 1)
            except Exception as exc:  # noqa: BLE001 - keep batch running and report per transaction.
                result = result.add_error(str(exc))
        return result

    def process_payloads(self, payloads: Iterable[dict]) -> PipelineResult:
        result = PipelineResult()
        for payload in payloads:
            result = PipelineResult(
                seen=result.seen + 1,
                raw_inserted=result.raw_inserted,
                posted=result.posted,
                skipped_pending=result.skipped_pending,
                skipped_duplicate=result.skipped_duplicate,
                skipped_zero_amount=result.skipped_zero_amount,
                errors=result.errors,
            )
            try:
                transaction = RawTransaction.from_akahu_payload(payload)
                inserted = self.database.upsert_raw_transaction(transaction)
                if inserted:
                    result = self._replace(result, raw_inserted=result.raw_inserted + 1)

                if transaction.is_pending and self.discard_pending:
                    self.database.mark_raw_skipped(transaction.idempotency_hash, "pending")
                    result = self._replace(result, skipped_pending=result.skipped_pending + 1)
                    continue

                if transaction.amount_cents == 0:
                    self.database.mark_raw_skipped(transaction.idempotency_hash, "zero_amount")
                    result = self._replace(
                        result, skipped_zero_amount=result.skipped_zero_amount + 1
                    )
                    continue

                if self.database.journal_exists(transaction.idempotency_hash):
                    result = self._replace(result, skipped_duplicate=result.skipped_duplicate + 1)
                    continue

                journal_transaction = self._build_journal_transaction(transaction)
                if self.database.insert_journal_transaction(journal_transaction):
                    result = self._replace(result, posted=result.posted + 1)
                else:
                    result = self._replace(result, skipped_duplicate=result.skipped_duplicate + 1)
            except Exception as exc:  # noqa: BLE001 - keep batch running and report per transaction.
                result = result.add_error(str(exc))
        return result

    @staticmethod
    def _replace(result: PipelineResult, **changes: int) -> PipelineResult:
        values = {
            "seen": result.seen,
            "raw_inserted": result.raw_inserted,
            "posted": result.posted,
            "skipped_pending": result.skipped_pending,
            "skipped_duplicate": result.skipped_duplicate,
            "skipped_zero_amount": result.skipped_zero_amount,
            "errors": result.errors,
        }
        values.update(changes)
        return PipelineResult(**values)

    def _resolve_route(self, transaction: RawTransaction) -> RouteDecision:
        """Manual per-transaction classifications win over rule/nzfcc routing."""
        override = self.database.get_manual_classification(transaction.idempotency_hash)
        if override is not None:
            target_account, memo = override
            return RouteDecision(
                target_account=target_account,
                rule_id="manual:override",
                memo=memo,
                matched_by="manual",
            )
        return self.router.route(transaction)

    def _build_journal_transaction(self, transaction: RawTransaction) -> JournalTransaction:
        account_mapping = self.router.account_mapping_for(transaction.account_id)
        route = self._resolve_route(transaction)
        amount_cents = abs(transaction.amount_cents)

        if transaction.amount_cents > 0:
            postings = (
                Posting(
                    account=account_mapping.ledger_account, side="debit", amount_cents=amount_cents
                ),
                Posting(account=route.target_account, side="credit", amount_cents=amount_cents),
            )
        else:
            postings = (
                Posting(account=route.target_account, side="debit", amount_cents=amount_cents),
                Posting(
                    account=account_mapping.ledger_account, side="credit", amount_cents=amount_cents
                ),
            )

        journal_transaction = JournalTransaction(
            external_id=transaction.idempotency_hash,
            transaction_date=transaction.settlement_date[:10]
            if transaction.settlement_date
            else transaction.transaction_date,
            description=transaction.description,
            source_account_id=transaction.account_id,
            status=transaction.status,
            rule_id=route.rule_id,
            postings=postings,
        )
        journal_transaction.validate_balanced()
        return journal_transaction
