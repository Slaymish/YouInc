from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - dependency is installed in normal project setup.

    def load_dotenv(*_: object, **__: object) -> bool:
        return False


@dataclass(frozen=True)
class Settings:
    akahu_base_url: str
    akahu_app_token: str | None
    akahu_user_token: str | None
    db_path: Path
    rules_path: Path
    ledger_path: Path
    discard_pending: bool
    rate_limit_seconds: float


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_settings(env_file: str | Path | None = ".env") -> Settings:
    if env_file:
        load_dotenv(env_file, override=False)

    return Settings(
        akahu_base_url=os.getenv("AKAHU_BASE_URL", "https://api.akahu.io/v1").rstrip("/"),
        akahu_app_token=os.getenv("AKAHU_APP_TOKEN") or None,
        akahu_user_token=os.getenv("AKAHU_USER_TOKEN") or None,
        db_path=Path(os.getenv("YOUINC_DB_PATH", "./data/youinc-ledger.sqlite3")),
        rules_path=Path(os.getenv("YOUINC_RULES_PATH", "./config/rules.yaml")),
        ledger_path=Path(os.getenv("YOUINC_LEDGER_PATH", "./ledger.journal")),
        discard_pending=_bool_env("YOUINC_DISCARD_PENDING", True),
        rate_limit_seconds=float(os.getenv("YOUINC_RATE_LIMIT_SECONDS", "0.25")),
    )
