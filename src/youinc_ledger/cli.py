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
from youinc_ledger.rules_router.rules_editor import (
    append_classification_rule,
    upsert_account_mapping,
)


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


def _validate_ledger_account(account: str) -> str:
    account = (account or "").strip()
    if ":" not in account:
        raise SystemExit(
            "Target account must be a colon-delimited account, e.g. Expenses:OpEx:MealsAndProvisions"
        )
    return account


def cmd_classify(args: argparse.Namespace) -> int:
    settings = load_settings()
    database = _build_database(args.db_path)
    rules_path = args.rules_path or settings.rules_path

    try:
        target_account = _validate_ledger_account(args.target_account)
    except SystemExit as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    transaction = database.fetch_raw_transaction(args.external_id)
    if transaction is None:
        print(f"ERROR: no transaction found for external id {args.external_id}", file=sys.stderr)
        return 1

    summary: dict[str, object] = {
        "externalId": args.external_id,
        "targetAccount": target_account,
        "mode": args.mode,
    }

    if args.mode == "once":
        database.set_manual_classification(args.external_id, target_account, args.memo)
    else:
        rule_id, pattern = append_classification_rule(
            rules_path,
            description=transaction.description,
            target_account=target_account,
            pattern=args.pattern,
            memo=args.memo,
        )
        summary["ruleId"] = rule_id
        summary["pattern"] = pattern

    router = RulesRouter.from_file(rules_path)
    pipeline = LedgerPipeline(database, router, discard_pending=settings.discard_pending)
    result = pipeline.reclassify_existing_journals()
    summary["reclassified"] = result.posted

    if args.json:
        print(json.dumps(summary, sort_keys=True))
    else:
        label = summary.get("ruleId", "one-off")
        print(
            f"Classified {args.external_id} -> {target_account} "
            f"({args.mode}:{label}); reclassified={result.posted}"
        )
    for error in result.errors:
        print(f"ERROR: {error}", file=sys.stderr)
    return 1 if result.errors else 0


def cmd_map_account(args: argparse.Namespace) -> int:
    settings = load_settings()
    rules_path = args.rules_path or settings.rules_path
    ledger_account = (args.ledger_account or "").strip()
    if ":" not in ledger_account:
        print(
            "ERROR: ledger account must be colon-delimited, e.g. Assets:Bank:BNZ", file=sys.stderr
        )
        return 1
    if args.account_type not in {"asset", "liability"}:
        print("ERROR: account type must be 'asset' or 'liability'", file=sys.stderr)
        return 1
    if args.credit_limit_cents is not None and args.credit_limit_cents < 0:
        print("ERROR: credit limit cents must be zero or positive", file=sys.stderr)
        return 1

    upsert_account_mapping(
        rules_path,
        account_id=args.account_id.strip(),
        ledger_account=ledger_account,
        account_type=args.account_type,
        credit_limit_cents=args.credit_limit_cents,
    )
    if args.json:
        print(
            json.dumps(
                {
                    "accountId": args.account_id.strip(),
                    "ledgerAccount": ledger_account,
                    "accountType": args.account_type,
                    "creditLimitCents": args.credit_limit_cents,
                },
                sort_keys=True,
            )
        )
    else:
        limit_label = (
            f", limit {args.credit_limit_cents / 100:.2f}"
            if args.credit_limit_cents is not None
            else ""
        )
        print(
            f"Mapped {args.account_id.strip()} -> {ledger_account} "
            f"({args.account_type}{limit_label})"
        )
    return 0


def cmd_set_balance(args: argparse.Namespace) -> int:
    database = _build_database(args.db_path)
    account = (args.account or "").strip()
    if ":" not in account:
        print(
            "ERROR: account must be colon-delimited, e.g. Assets:Investments:Blossom",
            file=sys.stderr,
        )
        return 1

    database.set_manual_balance(account, args.balance_cents, args.as_of_date)
    if args.json:
        print(json.dumps({"account": account, "balanceCents": args.balance_cents}, sort_keys=True))
    else:
        print(f"Set manual balance {account} = {args.balance_cents} cents")
    return 0


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

    classify = subparsers.add_parser(
        "classify", help="Classify a parked transaction and reclassify affected journals"
    )
    classify.add_argument("--db-path", type=Path)
    classify.add_argument("--rules-path", type=Path)
    classify.add_argument("--external-id", required=True)
    classify.add_argument("--target-account", required=True)
    classify.add_argument("--mode", choices=("rule", "once"), default="rule")
    classify.add_argument("--pattern", help="Override the derived description_regex (rule mode)")
    classify.add_argument("--memo")
    classify.add_argument("--json", action="store_true")
    classify.set_defaults(func=cmd_classify)

    map_account = subparsers.add_parser(
        "map-account", help="Map a source account id to a ledger account in rules.yaml"
    )
    map_account.add_argument("--rules-path", type=Path)
    map_account.add_argument("--account-id", required=True)
    map_account.add_argument("--ledger-account", required=True)
    map_account.add_argument("--account-type", choices=("asset", "liability"), default="asset")
    map_account.add_argument(
        "--credit-limit-cents",
        type=int,
        default=None,
        help="Credit limit for a revolving liability account (credit card), in cents",
    )
    map_account.add_argument("--json", action="store_true")
    map_account.set_defaults(func=cmd_map_account)

    set_balance = subparsers.add_parser("set-balance", help="Set a manual account balance override")
    set_balance.add_argument("--db-path", type=Path)
    set_balance.add_argument("--account", required=True)
    set_balance.add_argument("--balance-cents", type=int, required=True)
    set_balance.add_argument("--as-of-date")
    set_balance.add_argument("--json", action="store_true")
    set_balance.set_defaults(func=cmd_set_balance)

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
