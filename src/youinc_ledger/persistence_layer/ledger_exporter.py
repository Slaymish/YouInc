from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from youinc_ledger.models import cents_to_decimal
from youinc_ledger.persistence_layer.db import LedgerDatabase


def export_hledger(database: LedgerDatabase, output_path: str | Path) -> None:
    rows = database.fetch_journal_rows()
    grouped: dict[str, list] = defaultdict(list)
    order: list[str] = []
    for row in rows:
        external_id = str(row["external_id"])
        if external_id not in grouped:
            order.append(external_id)
        grouped[external_id].append(row)

    lines: list[str] = []
    for external_id in order:
        entries = grouped[external_id]
        first = entries[0]
        rule_part = f" rule:{first['rule_id']}" if first["rule_id"] else ""
        lines.append(
            f"{first['transaction_date']} {first['description']} ; akahu:{external_id}{rule_part}"
        )
        for entry in entries:
            amount = cents_to_decimal(int(entry["amount_cents"]))
            signed_amount = amount if entry["side"] == "debit" else -amount
            lines.append(f"    {entry['account']:<45} {entry['currency']} {signed_amount}")
        lines.append("")

    output = Path(output_path)
    if output.parent != Path("."):
        output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(lines), encoding="utf-8")
