from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any

import yaml

from youinc_ledger.models import RawTransaction, cents_to_decimal


@dataclass(frozen=True)
class AccountMapping:
    ledger_account: str
    account_type: str


@dataclass(frozen=True)
class RouteDecision:
    target_account: str
    rule_id: str | None
    memo: str | None = None
    matched_by: str = "rule"


class RulesRouter:
    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.defaults = config.get("defaults", {})
        self.rules = sorted(
            enumerate(config.get("rules", [])),
            key=lambda item: (int(item[1].get("priority", 1000)), item[0]),
        )
        self.nzfcc_mappings = config.get("nzfcc_mappings", {}) or {}
        self.account_mappings = config.get("account_mappings", {}) or {}

    @classmethod
    def from_file(cls, path: str | Path) -> "RulesRouter":
        with Path(path).open("r", encoding="utf-8") as file:
            config = yaml.safe_load(file) or {}
        return cls(config)

    @property
    def suspense_account(self) -> str:
        return str(self.defaults.get("suspense_account", "Expenses:Uncategorized:Suspense"))

    def account_mapping_for(self, account_id: str) -> AccountMapping:
        raw = self.account_mappings.get(account_id)
        if raw:
            return AccountMapping(
                ledger_account=str(raw["ledger_account"]),
                account_type=str(raw.get("account_type", "asset")).lower(),
            )
        safe_id = re.sub(r"[^A-Za-z0-9_:-]", "_", account_id)
        return AccountMapping(ledger_account=f"Assets:Unmapped:{safe_id}", account_type="asset")

    def route(self, transaction: RawTransaction) -> RouteDecision:
        for _, rule in self.rules:
            if self._matches(rule.get("match", {}) or {}, transaction):
                route = rule.get("route", {}) or {}
                return RouteDecision(
                    target_account=str(route["target_account"]),
                    rule_id=str(rule.get("id")),
                    memo=route.get("memo"),
                    matched_by="rule",
                )

        if transaction.nzfcc:
            nzfcc_route = self.nzfcc_mappings.get(transaction.nzfcc)
            if nzfcc_route:
                return RouteDecision(
                    target_account=str(nzfcc_route["target_account"]),
                    rule_id=f"nzfcc:{transaction.nzfcc}",
                    matched_by="nzfcc",
                )

        return RouteDecision(
            target_account=self.suspense_account,
            rule_id=None,
            matched_by="suspense",
        )

    def _matches(self, match: dict[str, Any], transaction: RawTransaction) -> bool:
        description = transaction.description or ""
        merchant = transaction.merchant_name or ""
        amount = cents_to_decimal(transaction.amount_cents)
        absolute_amount = abs(amount)

        if account_ids := match.get("account_ids"):
            if transaction.account_id not in set(account_ids):
                return False

        if currencies := match.get("currencies"):
            if transaction.currency not in set(currencies):
                return False

        if pattern := match.get("description_regex"):
            if not re.search(str(pattern), description):
                return False

        if pattern := match.get("merchant_regex"):
            if not re.search(str(pattern), merchant):
                return False

        if nzfcc_codes := match.get("nzfcc"):
            expected = {str(code) for code in nzfcc_codes}
            if transaction.nzfcc not in expected:
                return False

        if "amount_greater_than" in match:
            if amount <= Decimal(str(match["amount_greater_than"])):
                return False

        if "amount_less_than" in match:
            if amount >= Decimal(str(match["amount_less_than"])):
                return False

        if "amount_abs_greater_than" in match:
            if absolute_amount <= Decimal(str(match["amount_abs_greater_than"])):
                return False

        if "amount_abs_less_than" in match:
            if absolute_amount >= Decimal(str(match["amount_abs_less_than"])):
                return False

        return True
