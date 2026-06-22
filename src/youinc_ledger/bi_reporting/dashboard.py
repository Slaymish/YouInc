from __future__ import annotations

import argparse
import os
from pathlib import Path

import streamlit as st

from youinc_ledger.config import load_settings
from youinc_ledger.models import cents_to_decimal
from youinc_ledger.persistence_layer.db import LedgerDatabase


def _account_type(account: str) -> str:
    return account.split(":", 1)[0] if ":" in account else "Other"


def _format_money(cents: int) -> str:
    return f"NZD {cents_to_decimal(cents):,.2f}"


def _load_db_path() -> Path:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--db-path", type=Path)
    args, _ = parser.parse_known_args()
    if args.db_path:
        return args.db_path
    return Path(os.getenv("YOUINC_DB_PATH", load_settings().db_path))


def render_dashboard(database: LedgerDatabase) -> None:
    st.set_page_config(page_title="YouInc BI Dashboard", layout="wide")
    st.title("YouInc Executive BI Dashboard")

    balances = database.fetch_balances()
    income_statement = database.fetch_income_statement()

    typed_balances: dict[str, int] = {}
    for row in balances:
        account_type = _account_type(str(row["account"]))
        typed_balances[account_type] = typed_balances.get(account_type, 0) + int(
            row["balance_cents"]
        )

    assets = typed_balances.get("Assets", 0)
    liabilities = -typed_balances.get("Liabilities", 0)
    net_worth = assets - liabilities
    ratio = assets / liabilities if liabilities else 0

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Net Worth", _format_money(net_worth))
    col2.metric("Assets", _format_money(assets))
    col3.metric("Liabilities", _format_money(liabilities))
    col4.metric("Asset / Liability", f"{ratio:.2f}" if liabilities else "No liabilities")

    st.subheader("Balance Sheet")
    if balances:
        st.dataframe(
            [
                {
                    "Account": row["account"],
                    "Type": _account_type(str(row["account"])),
                    "Balance": float(cents_to_decimal(int(row["balance_cents"]))),
                    "Currency": row["currency"],
                }
                for row in balances
            ],
            use_container_width=True,
        )
    else:
        st.info("No posted ledger balances yet. Run sync first.")

    st.subheader("P&L Statement")
    monthly: dict[str, dict[str, int]] = {}
    for row in income_statement:
        month = str(row["month"])
        account = str(row["account"])
        amount = int(row["amount_cents"])
        bucket = monthly.setdefault(month, {"income": 0, "expenses": 0})
        if account.startswith("Income:"):
            bucket["income"] += amount
        elif account.startswith("Expenses:"):
            bucket["expenses"] += -amount

    if monthly:
        pnl_rows = []
        total_overhead = 0
        for month, values in sorted(monthly.items()):
            income = values["income"]
            expenses = values["expenses"]
            ebitda = income - expenses
            margin = ebitda / income if income else 0
            total_overhead += expenses
            pnl_rows.append(
                {
                    "Month": month,
                    "Income": float(cents_to_decimal(income)),
                    "Operating Expenses": float(cents_to_decimal(expenses)),
                    "EBITDA": float(cents_to_decimal(ebitda)),
                    "EBITDA Margin": f"{margin:.1%}" if income else "n/a",
                }
            )
        st.dataframe(pnl_rows, use_container_width=True)

        average_overhead = total_overhead / max(len(monthly), 1)
        runway_months = assets / average_overhead if average_overhead else 0
        st.metric("Monthly Recurring Overhead", _format_money(int(average_overhead)))
        st.metric("Operating Runway", f"{runway_months:.1f} months" if average_overhead else "n/a")
    else:
        st.info("No income or expense postings yet.")


def main() -> None:
    db_path = _load_db_path()
    database = LedgerDatabase(db_path)
    database.init_schema()
    render_dashboard(database)


if __name__ == "__main__":
    main()
