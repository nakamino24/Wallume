from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api import auth, reports, transactions, wallets
from app.main import app
from app.repositories.base import BaseRepository
from app.security.auth import hash_password


client = TestClient(app)
USER = {"user_id": "user_contract", "email": "contract@wallume.app", "currency": "IDR"}


def assert_success(response, data_key=None, status=200):
    assert response.status_code == status, response.text
    body = response.json()
    assert body["success"] is True
    assert "data" in body
    if data_key:
        assert data_key in body["data"]
    return body["data"]


def test_openapi_contains_required_contract_routes():
    paths = app.openapi()["paths"]
    for path in (
        "/api/auth/signup",
        "/api/auth/login",
        "/api/auth/password-reset/request",
        "/api/auth/password-reset/resend",
        "/api/auth/password-reset/verify",
        "/api/auth/password-reset/confirm",
        "/api/auth/me",
        "/api/wallets",
        "/api/transactions",
        "/api/reports/summary",
    ):
        assert path in paths


def test_password_reset_endpoints_use_safe_envelopes():
    public = {
        "request_id": "request_contract",
        "message": "If an eligible account exists, a verification code has been sent.",
    }
    with patch.object(auth.password_reset_service, "request", AsyncMock(return_value=public)):
        data = assert_success(client.post("/api/auth/password-reset/request", json={
            "email": "contract@wallume.app", "locale": "id",
        }))
        assert data == public

    with patch.object(
        auth.password_reset_service, "resend", AsyncMock(return_value=public)
    ) as resend:
        data = assert_success(client.post("/api/auth/password-reset/resend", json={
            "request_id": "request_contract",
        }))
        assert data == public
        assert resend.await_args.args[0] == "request_contract"
        assert resend.await_args.args[1].__class__.__name__ == "BackgroundTasks"

    reset_token = "opaque-reset-token-that-is-at-least-32-characters"
    verified = {"reset_token": reset_token, "expires_in": 600}
    with patch.object(auth.password_reset_service, "verify", AsyncMock(return_value=verified)):
        data = assert_success(client.post("/api/auth/password-reset/verify", json={
            "request_id": "request_contract", "code": "123456",
        }))
        assert data == verified

    with patch.object(auth.password_reset_service, "confirm", AsyncMock(return_value=None)):
        data = assert_success(client.post("/api/auth/password-reset/confirm", json={
            "reset_token": reset_token,
            "new_password": "NewPassword456",
            "confirm_password": "NewPassword456",
        }))
        assert data == {"message": "Password updated. Sign in with your new password."}


def test_auth_success_endpoints_use_current_envelope():
    auth_result = {"token": "token_contract", "user": USER}
    with patch.object(auth.auth_service, "signup", AsyncMock(return_value=auth_result)):
        data = assert_success(client.post("/api/auth/signup", json={
            "email": "contract@wallume.app", "password": "Password123", "name": "Contract",
        }))
        assert data == auth_result

    with patch.object(auth.auth_service, "login", AsyncMock(return_value=auth_result)):
        data = assert_success(client.post("/api/auth/login", json={
            "email": "contract@wallume.app", "password": "Password123",
        }))
        assert data == auth_result

    with patch.object(auth.auth_service, "get_current_user", AsyncMock(return_value=USER)):
        data = assert_success(client.get("/api/auth/me", headers={"Authorization": "Bearer token"}), "user")
        assert data["user"]["user_id"] == USER["user_id"]


def test_legacy_user_crosses_repository_service_and_login_endpoint():
    legacy = {
        "user_id": "user_legacy",
        "email": "legacy@wallume.app",
        "name": "Legacy",
        "password_hash": hash_password("Password123"),
        "provider": "email",
        "created_at": "2026-07-25T00:00:00Z",
    }
    with patch.object(BaseRepository, "find_one", AsyncMock(return_value=legacy)):
        response = client.post("/api/auth/login", json={
            "email": " LEGACY@WALLUME.APP ", "password": "Password123",
        })
    data = assert_success(response)
    assert data["user"]["user_id"] == "user_legacy"
    assert data["user"]["currency"] == "USD"
    assert data["user"]["theme"] == "light"
    assert data["user"]["work_week"] == 5


def test_wallet_transaction_and_report_endpoints_use_current_envelope():
    legacy_tx = {"id": "tx_legacy", "date": "2026-08-28", "amount": 1000.0}
    summary = {
        "transaction_count": 1,
        "income_total": 0.0,
        "expense_total": 1000.0,
        "net_total": -1000.0,
        "expense_by_category": [{"category": "Food", "amount": 1000.0}],
    }
    with patch.object(wallets.auth_service, "get_current_user", AsyncMock(return_value=USER)), \
         patch.object(wallets.wallets, "find_by_user", AsyncMock(return_value=[])):
        assert_success(client.get("/api/wallets", headers={"Authorization": "Bearer token"}), "wallets")

    with patch.object(transactions.auth_service, "get_current_user", AsyncMock(return_value=USER)), \
         patch.object(transactions.txs, "find_by_user", AsyncMock(return_value=[legacy_tx])):
        data = assert_success(client.get("/api/transactions", headers={"Authorization": "Bearer token"}), "transactions")
        assert data["transactions"] == [legacy_tx]

    with patch.object(reports.auth_service, "get_current_user", AsyncMock(return_value=USER)), \
         patch.object(reports.txs, "aggregate_report_summary", AsyncMock(return_value=summary)):
        data = assert_success(client.get(
            "/api/reports/summary?from_date=2026-08-01&to_date=2026-08-31",
            headers={"Authorization": "Bearer token"},
        ))
        assert data["transaction_count"] == 1


def test_fastapi_error_contract_remains_detail_based():
    with patch.object(auth.auth_service, "get_current_user", AsyncMock(side_effect=HTTPException(401, "Invalid token"))):
        response = client.get("/api/auth/me", headers={"Authorization": "Bearer bad"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid token"}
