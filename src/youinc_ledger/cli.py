from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from youinc_ledger.config import load_settings
from youinc_ledger.ingest_service.akahu_client import (
    AkahuApiError,
    AkahuClient,
    load_mock_transactions,
)
from youinc_ledger.ledger_pipeline.pipeline import LedgerPipeline
from youinc_ledger.persistence_layer.db import LedgerDatabase
from youinc_ledger.persistence_layer.ledger_exporter import export_hledger
from youinc_ledger.rules_router.rules import RulesRouter


def _build_database(db_path: Path | None) -> LedgerDatabase:
    settings = load_settings()
    database = LedgerDatabase(db_path or settings.db_path)
    database.init_schema()
    return database


def cmd_init_db(args: argparse.Namespace) -> int:
    database = _build_database(args.db_path)
    print(f"Initialized SQLite ledger at {database.path}")
    return 0


def _build_akahu_client() -> AkahuClient:
    settings = load_settings()
    return AkahuClient(
        base_url=settings.akahu_base_url,
        app_token=settings.akahu_app_token,
        user_token=settings.akahu_user_token,
        rate_limit_seconds=settings.rate_limit_seconds,
    )


def _load_payloads(args: argparse.Namespace) -> list[dict]:
    settings = load_settings()
    if args.mock_file:
        return load_mock_transactions(args.mock_file)

    if not args.account_id:
        raise SystemExit("Live sync requires --account-id unless --mock-file is provided")

    start_date = args.start_date
    if args.delta and not start_date:
        database = LedgerDatabase(args.db_path or settings.db_path)
        database.init_schema()
        start_date = database.get_sync_state(f"last_sync:{args.account_id}")

    client = _build_akahu_client()
    return list(
        client.iter_transactions(
            account_id=args.account_id,
            start_date=start_date,
            end_date=args.end_date,
        )
    )


def _latest_payload_date(payloads: list[dict]) -> str | None:
    dates = [
        str(
            payload.get("settlement_date") or payload.get("settled_at") or payload.get("date") or ""
        )[:10]
        for payload in payloads
    ]
    valid_dates = [date for date in dates if date]
    return max(valid_dates) if valid_dates else None


def _account_label(account: dict) -> str:
    provider = (
        account.get("provider") or account.get("connection") or account.get("institution") or {}
    )
    if isinstance(provider, dict):
        provider_name = provider.get("name") or provider.get("id") or provider.get("_id")
    else:
        provider_name = provider

    parts = [
        account.get("name"),
        account.get("formatted_account"),
        account.get("account_number"),
        provider_name,
    ]
    return " · ".join(str(part) for part in parts if part) or str(
        account.get("_id") or account.get("id") or "Unnamed account"
    )


def _summarize_account(account: dict) -> dict[str, object]:
    account_id = account.get("_id") or account.get("id")
    return {
        "id": str(account_id) if account_id else "",
        "name": str(account.get("name") or "Unnamed account"),
        "label": _account_label(account),
        "status": account.get("status") or account.get("state"),
        "type": account.get("type"),
        "raw": account,
    }


def cmd_accounts(args: argparse.Namespace) -> int:
    try:
        accounts = [
            _summarize_account(account) for account in _build_akahu_client().list_accounts()
        ]
    except AkahuApiError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(accounts, indent=2, sort_keys=True))
    else:
        for account in accounts:
            print(f"{account['id']} | {account['label']}")
    return 0


def cmd_sync(args: argparse.Namespace) -> int:
    settings = load_settings()
    database = _build_database(args.db_path)
    router = RulesRouter.from_file(args.rules_path or settings.rules_path)
    try:
        payloads = _load_payloads(args)
    except AkahuApiError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    pipeline = LedgerPipeline(database, router, discard_pending=settings.discard_pending)
    result = pipeline.process_payloads(payloads)

    if args.account_id:
        sync_marker = args.end_date or _latest_payload_date(payloads)
        if sync_marker:
            database.set_sync_state(f"last_sync:{args.account_id}", sync_marker)

    print(
        "Sync complete: "
        f"seen={result.seen}, raw_inserted={result.raw_inserted}, posted={result.posted}, "
        f"pending={result.skipped_pending}, duplicates={result.skipped_duplicate}, "
        f"zero_amount={result.skipped_zero_amount}, errors={len(result.errors)}"
    )
    for error in result.errors:
        print(f"ERROR: {error}", file=sys.stderr)
    return 1 if result.errors else 0


def cmd_reclassify(args: argparse.Namespace) -> int:
    settings = load_settings()
    database = _build_database(args.db_path)
    router = RulesRouter.from_file(args.rules_path or settings.rules_path)
    pipeline = LedgerPipeline(database, router, discard_pending=settings.discard_pending)
    result = pipeline.reclassify_existing_journals()
    print(
        "Reclassify complete: "
        f"seen={result.seen}, rewritten={result.posted}, "
        f"zero_amount={result.skipped_zero_amount}, errors={len(result.errors)}"
    )
    for error in result.errors:
        print(f"ERROR: {error}", file=sys.stderr)
    return 1 if result.errors else 0


def cmd_rules_test(args: argparse.Namespace) -> int:
    settings = load_settings()
    router = RulesRouter.from_file(args.rules_path or settings.rules_path)
    payloads = _load_payloads(args)

    from youinc_ledger.models import RawTransaction  # Local import keeps CLI startup small.

    unmatched = 0
    for payload in payloads:
        transaction = RawTransaction.from_akahu_payload(payload)
        route = router.route(transaction)
        if route.matched_by == "suspense":
            unmatched += 1
        print(
            f"{transaction.transaction_date} | {transaction.account_id} | "
            f"{transaction.description} | {transaction.amount_cents / 100:.2f} "
            f"=> {route.target_account} ({route.matched_by}:{route.rule_id or 'none'})"
        )
    print(f"Unmatched/suspense transactions: {unmatched}")
    return 0


def cmd_export_journal(args: argparse.Namespace) -> int:
    settings = load_settings()
    database = _build_database(args.db_path)
    output = args.output or settings.ledger_path
    export_hledger(database, output)
    print(f"Exported hledger journal to {output}")
    return 0


def cmd_dashboard(args: argparse.Namespace) -> int:
    dashboard_path = Path(__file__).parent / "bi_reporting" / "dashboard.py"
    command = [sys.executable, "-m", "streamlit", "run", str(dashboard_path)]
    if args.db_path:
        command.extend(["--", "--db-path", str(args.db_path)])
    return subprocess.call(command)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="youinc-ledger")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_db = subparsers.add_parser("init-db", help="Initialize the local SQLite schema")
    init_db.add_argument("--db-path", type=Path)
    init_db.set_defaults(func=cmd_init_db)

    sync = subparsers.add_parser("sync", help="Pull transactions, apply rules, and update ledger")
    sync.add_argument("--db-path", type=Path)
    sync.add_argument("--rules-path", type=Path)
    sync.add_argument("--mock-file", type=Path)
    sync.add_argument("--account-id")
    sync.add_argument("--start-date")
    sync.add_argument("--end-date")
    sync.add_argument("--delta", action="store_true")
    sync.set_defaults(func=cmd_sync)

    accounts = subparsers.add_parser("accounts", help="List Akahu source accounts")
    accounts.add_argument("--json", action="store_true")
    accounts.set_defaults(func=cmd_accounts)

    reclassify = subparsers.add_parser(
        "reclassify", help="Rebuild existing journal postings from cached raw transactions"
    )
    reclassify.add_argument("--db-path", type=Path)
    reclassify.add_argument("--rules-path", type=Path)
    reclassify.set_defaults(func=cmd_reclassify)

    rules_test = subparsers.add_parser("rules-test", help="Dry-run classification rules")
    rules_test.add_argument("--db-path", type=Path)
    rules_test.add_argument("--rules-path", type=Path)
    rules_test.add_argument("--mock-file", type=Path, required=True)
    rules_test.add_argument("--account-id")
    rules_test.add_argument("--start-date")
    rules_test.add_argument("--end-date")
    rules_test.add_argument("--delta", action="store_true")
    rules_test.set_defaults(func=cmd_rules_test)

    export = subparsers.add_parser("export-journal", help="Export SQL ledger to hledger journal")
    export.add_argument("--db-path", type=Path)
    export.add_argument("--output", type=Path)
    export.set_defaults(func=cmd_export_journal)

    dashboard = subparsers.add_parser("dashboard", help="Run local Streamlit dashboard")
    dashboard.add_argument("--db-path", type=Path)
    dashboard.set_defaults(func=cmd_dashboard)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
