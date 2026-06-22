from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Literal

Side = Literal["debit", "credit"]


def utc_now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def decimal_to_cents(value: Decimal | int | float | str) -> int:
    decimal_value = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return int(decimal_value * 100)


def cents_to_decimal(cents: int) -> Decimal:
    return (Decimal(cents) / Decimal(100)).quantize(Decimal("0.01"))


def normalize_status(raw: dict[str, Any]) -> str:
    status = raw.get("status") or raw.get("state") or raw.get("type") or "SETTLED"
    return str(status).upper()


def is_pending_status(status: str) -> bool:
    return status.upper() in {"PENDING", "AUTHORISED", "AUTHORIZED", "HELD"}


def extract_merchant_name(raw: dict[str, Any]) -> str | None:
    merchant = raw.get("merchant")
    if isinstance(merchant, dict):
        return merchant.get("name") or merchant.get("clean_name") or merchant.get("display_name")
    if isinstance(merchant, str):
        return merchant
    return raw.get("merchant_name") or raw.get("merchantName")


def extract_nzfcc(raw: dict[str, Any]) -> str | None:
    category = raw.get("category") or raw.get("categories")
    if isinstance(category, dict):
        return category.get("nzfcc") or category.get("code")
    return raw.get("nzfcc")


def stable_json(raw: dict[str, Any]) -> str:
    return json.dumps(raw, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


@dataclass(frozen=True)
class RawTransaction:
    idempotency_hash: str
    akahu_transaction_id: str | None
    account_id: str
    status: str
    amount_cents: int
    currency: str
    transaction_date: str
    settlement_date: str | None
    description: str
    merchant_name: str | None
    nzfcc: str | None
    raw_json: str

    @property
    def is_pending(self) -> bool:
        return is_pending_status(self.status)

    @classmethod
    def from_akahu_payload(cls, raw: dict[str, Any]) -> "RawTransaction":
        account_id = str(raw.get("_account") or raw.get("account") or raw.get("account_id") or "")
        if not account_id:
            raise ValueError("Akahu transaction is missing account identifier")

        transaction_date = str(raw.get("date") or raw.get("created_at") or raw.get("posted_at") or "")[:10]
        if not transaction_date:
            raise ValueError("Akahu transaction is missing transaction date")

        description = str(raw.get("description") or raw.get("raw_description") or raw.get("name") or "").strip()
        if not description:
            raise ValueError("Akahu transaction is missing description")

        akahu_transaction_id = raw.get("_id") or raw.get("id")
        akahu_transaction_id = str(akahu_transaction_id) if akahu_transaction_id else None
        amount_cents = decimal_to_cents(raw.get("amount", 0))
        merchant_name = extract_merchant_name(raw)
        status = normalize_status(raw)

        if akahu_transaction_id:
            hash_input = f"akahu:{akahu_transaction_id}"
        else:
            hash_input = "|".join(
                [
                    account_id,
                    transaction_date,
                    str(raw.get("amount", 0)),
                    description,
                    merchant_name or "",
                ]
            )

        idempotency_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

        return cls(
            idempotency_hash=idempotency_hash,
            akahu_transaction_id=akahu_transaction_id,
            account_id=account_id,
            status=status,
            amount_cents=amount_cents,
            currency=str(raw.get("currency") or "NZD").upper(),
            transaction_date=transaction_date,
            settlement_date=(raw.get("settlement_date") or raw.get("settled_at") or None),
            description=description,
            merchant_name=merchant_name,
            nzfcc=extract_nzfcc(raw),
            raw_json=stable_json(raw),
        )


@dataclass(frozen=True)
class Posting:
    account: str
    side: Side
    amount_cents: int
    currency: str = "NZD"


@dataclass(frozen=True)
class JournalTransaction:
    external_id: str
    transaction_date: str
    description: str
    source_account_id: str
    status: str
    rule_id: str | None
    postings: tuple[Posting, ...]

    def validate_balanced(self) -> None:
        debit_total = sum(p.amount_cents for p in self.postings if p.side == "debit")
        credit_total = sum(p.amount_cents for p in self.postings if p.side == "credit")
        if debit_total <= 0 or credit_total <= 0:
            raise ValueError("Journal transaction must include positive debit and credit postings")
        if debit_total != credit_total:
            raise ValueError(
                f"Unbalanced journal transaction {self.external_id}: "
                f"debits={debit_total}, credits={credit_total}"
            )
