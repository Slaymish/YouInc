from __future__ import annotations

import certifi
import pytest
import requests

from youinc_ledger.ingest_service.akahu_client import AkahuApiError, AkahuClient


def test_client_uses_certifi_ca_bundle_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    class Response:
        status_code = 200

        @staticmethod
        def json() -> dict[str, list[object]]:
            return {"items": []}

    def fake_get(*_: object, **kwargs: object) -> Response:
        captured.update(kwargs)
        return Response()

    monkeypatch.delenv("AKAHU_CA_BUNDLE", raising=False)
    monkeypatch.setenv("REQUESTS_CA_BUNDLE", "/Users/hamish/.mitmproxy/mitmproxy-ca-cert.pem")
    monkeypatch.setenv("SSL_CERT_FILE", "/Users/hamish/.mitmproxy/mitmproxy-ca-cert.pem")
    monkeypatch.setattr(requests, "get", fake_get)
    client = AkahuClient(
        base_url="https://api.akahu.io/v1",
        app_token="app_token",
        user_token="user_token",
    )

    client._get("/accounts/example/transactions", {})

    assert captured["verify"] == certifi.where()


def test_client_only_uses_explicit_akahu_ca_bundle_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AKAHU_CA_BUNDLE", "/tmp/akahu-ca.pem")

    client = AkahuClient(
        base_url="https://api.akahu.io/v1",
        app_token="app_token",
        user_token="user_token",
    )

    assert client.ca_bundle_path == "/tmp/akahu-ca.pem"


def test_list_accounts_accepts_accounts_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    class Response:
        status_code = 200

        @staticmethod
        def json() -> dict[str, list[dict[str, str]]]:
            return {"accounts": [{"_id": "acc_live_123", "name": "BNZ Everyday"}]}

    monkeypatch.setattr(requests, "get", lambda *_args, **_kwargs: Response())
    client = AkahuClient(
        base_url="https://api.akahu.io/v1",
        app_token="app_token",
        user_token="user_token",
    )

    assert client.list_accounts() == [{"_id": "acc_live_123", "name": "BNZ Everyday"}]


def test_invalid_account_id_error_is_actionable(monkeypatch: pytest.MonkeyPatch) -> None:
    class Response:
        status_code = 400
        text = '{"message":"pathParams.id is not a valid identifier"}'

    monkeypatch.setattr(requests, "get", lambda *_args, **_kwargs: Response())
    client = AkahuClient(
        base_url="https://api.akahu.io/v1",
        app_token="app_token",
        user_token="user_token",
    )

    with pytest.raises(AkahuApiError, match="not the bank name"):
        client._get("/accounts/BNZ/transactions", {})


def test_ssl_failures_raise_actionable_akahu_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_with_ssl_error(*_: object, **__: object) -> None:
        raise requests.exceptions.SSLError("certificate verify failed")

    monkeypatch.setattr(requests, "get", fail_with_ssl_error)
    client = AkahuClient(
        base_url="https://api.akahu.io/v1",
        app_token="app_token",
        user_token="user_token",
        ca_bundle_path="/tmp/custom-ca.pem",
    )

    with pytest.raises(AkahuApiError, match="AKAHU_CA_BUNDLE"):
        client._get("/accounts/example/transactions", {})


def test_proxy_failures_raise_actionable_akahu_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_with_proxy_error(*_: object, **__: object) -> None:
        raise requests.exceptions.ProxyError("Unable to connect to proxy 127.0.0.1:8080")

    monkeypatch.setattr(requests, "get", fail_with_proxy_error)
    client = AkahuClient(
        base_url="https://api.akahu.io/v1",
        app_token="app_token",
        user_token="user_token",
    )

    with pytest.raises(AkahuApiError, match="local HTTP proxy"):
        client._get("/accounts/example/transactions", {})
