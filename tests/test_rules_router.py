from __future__ import annotations

from youinc_ledger.models import RawTransaction
from youinc_ledger.rules_router.rules import RulesRouter


def _router() -> RulesRouter:
    return RulesRouter(
        {
            "defaults": {"suspense_account": "Expenses:Uncategorized:Suspense"},
            "account_mappings": {
                "acc_bnz_cash_example": {
                    "ledger_account": "Assets:BNZ:Cash",
                    "account_type": "asset",
                }
            },
            "nzfcc_mappings": {
                "utilities": {"target_account": "Expenses:OpEx:Utilities"},
            },
            "rules": [
                {
                    "id": "spark",
                    "priority": 10,
                    "match": {"description_regex": "(?i)spark"},
                    "route": {"target_account": "Expenses:OpEx:Software:SaaS"},
                }
            ],
        }
    )


def test_regex_rule_routes_transaction() -> None:
    transaction = RawTransaction.from_akahu_payload(
        {
            "_id": "txn_1",
            "_account": "acc_bnz_cash_example",
            "status": "SETTLED",
            "date": "2026-06-03",
            "amount": -89.99,
            "description": "SPARK NZ LTD AUCKLAND NZ",
        }
    )

    decision = _router().route(transaction)

    assert decision.target_account == "Expenses:OpEx:Software:SaaS"
    assert decision.rule_id == "spark"


def test_nzfcc_fallback_routes_when_no_rule_matches() -> None:
    transaction = RawTransaction.from_akahu_payload(
        {
            "_id": "txn_2",
            "_account": "acc_bnz_cash_example",
            "status": "SETTLED",
            "date": "2026-06-03",
            "amount": -42,
            "description": "POWER COMPANY",
            "category": {"nzfcc": "utilities"},
        }
    )

    decision = _router().route(transaction)

    assert decision.target_account == "Expenses:OpEx:Utilities"
    assert decision.rule_id == "nzfcc:utilities"


def test_suspense_routes_unmatched_transaction() -> None:
    transaction = RawTransaction.from_akahu_payload(
        {
            "_id": "txn_3",
            "_account": "acc_bnz_cash_example",
            "status": "SETTLED",
            "date": "2026-06-03",
            "amount": -42,
            "description": "UNKNOWN TERMINAL TEXT",
        }
    )

    decision = _router().route(transaction)

    assert decision.target_account == "Expenses:Uncategorized:Suspense"
    assert decision.rule_id is None
