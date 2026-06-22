from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Iterator

import certifi
import requests
from requests.exceptions import RequestException, SSLError


class AkahuApiError(RuntimeError):
    """Raised for Akahu API failures with actionable local diagnostics."""


class AkahuClient:
    def __init__(
        self,
        base_url: str,
        app_token: str | None,
        user_token: str | None,
        rate_limit_seconds: float = 0.25,
        timeout_seconds: int = 30,
        ca_bundle_path: str | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.app_token = app_token
        self.user_token = user_token
        self.rate_limit_seconds = rate_limit_seconds
        self.timeout_seconds = timeout_seconds
        self.ca_bundle_path = ca_bundle_path or os.getenv("AKAHU_CA_BUNDLE") or certifi.where()

    def _headers(self) -> dict[str, str]:
        if not self.app_token or not self.user_token:
            raise AkahuApiError(
                "Missing Akahu credentials. Set AKAHU_APP_TOKEN and AKAHU_USER_TOKEN in .env "
                "or environment variables before live sync."
            )
        return {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.user_token}",
            "X-Akahu-ID": self.app_token,
        }

    def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            response = requests.get(
                url,
                headers=self._headers(),
                params={key: value for key, value in params.items() if value is not None},
                timeout=self.timeout_seconds,
                verify=self.ca_bundle_path,
            )
        except RequestException as exc:
            message = str(exc)
            if isinstance(exc, SSLError) or "certificate verify failed" in message.lower():
                raise AkahuApiError(
                    "Akahu TLS certificate verification failed. The client used CA bundle "
                    f"{self.ca_bundle_path}. If you are behind a TLS-inspecting network/proxy, "
                    "set AKAHU_CA_BUNDLE to that network's PEM CA bundle and restart the frontend. "
                    "Also check that your system date/time is correct."
                ) from exc
            if "ProxyError" in message or "proxy" in message.lower():
                raise AkahuApiError(
                    "Could not reach Akahu because a local HTTP proxy is configured but unavailable. "
                    "Unset HTTPS_PROXY/HTTP_PROXY/ALL_PROXY or start the proxy, then retry."
                ) from exc
            raise AkahuApiError(f"Could not reach Akahu: {message}") from exc

        if response.status_code == 401:
            raise AkahuApiError("Akahu returned 401 Unauthorized. Check local tokens.")
        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After", "unknown")
            raise AkahuApiError(f"Akahu rate limit exceeded. Retry-After: {retry_after}")
        if 500 <= response.status_code <= 599:
            raise AkahuApiError(f"Akahu server error {response.status_code}: {response.text[:500]}")
        if response.status_code == 400 and "pathParams.id" in response.text:
            raise AkahuApiError(
                "Akahu rejected the account id. Use the Akahu account identifier from /accounts "
                "(usually starts with 'acc_'), not the bank name such as BNZ."
            )
        if response.status_code >= 400:
            raise AkahuApiError(f"Akahu API error {response.status_code}: {response.text[:500]}")

        return response.json()

    @staticmethod
    def _extract_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
        if isinstance(payload.get("items"), list):
            return payload["items"]
        if isinstance(payload.get("transactions"), list):
            return payload["transactions"]
        if isinstance(payload.get("accounts"), list):
            return payload["accounts"]
        if isinstance(payload.get("data"), list):
            return payload["data"]
        return []

    @staticmethod
    def _extract_next_cursor(payload: dict[str, Any]) -> str | None:
        cursor = payload.get("cursor")
        if isinstance(cursor, dict):
            next_cursor = cursor.get("next") or cursor.get("after")
            return str(next_cursor) if next_cursor else None
        next_cursor = payload.get("next") or payload.get("next_cursor")
        return str(next_cursor) if next_cursor else None

    def list_accounts(self) -> list[dict[str, Any]]:
        return self._extract_items(self._get("/accounts", {}))

    def iter_transactions(
        self,
        account_id: str,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int = 100,
    ) -> Iterator[dict[str, Any]]:
        cursor: str | None = None
        while True:
            payload = self._get(
                f"/accounts/{account_id}/transactions",
                {
                    "start": start_date,
                    "end": end_date,
                    "limit": limit,
                    "cursor": cursor,
                },
            )
            yield from self._extract_items(payload)
            cursor = self._extract_next_cursor(payload)
            if not cursor:
                break
            time.sleep(self.rate_limit_seconds)


def load_mock_transactions(path: str | Path) -> list[dict[str, Any]]:
    with Path(path).open("r", encoding="utf-8") as file:
        payload = json.load(file)
    if isinstance(payload, dict):
        if isinstance(payload.get("items"), list):
            return payload["items"]
        if isinstance(payload.get("transactions"), list):
            return payload["transactions"]
    if isinstance(payload, list):
        return payload
    raise ValueError(f"Mock transaction file {path} must contain a list or Akahu-like payload")
