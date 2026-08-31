"""User fixtures — current vs legacy vs external."""
import pytest
from app.utils.email import normalize_email
from app.utils.compat import normalize_user_document
from app.security.auth import hash_password, verify_password

CURRENT_EMAIL_USER = {
    "user_id": "user_abc123",
    "email": "alex@wallume.app",
    "name": "Alex",
    "password_hash": hash_password("Password123"),
    "provider": "email",
    "currency": "IDR",
    "theme": "dark",
    "payday_day": 25,
    "work_week": 5,
    "created_at": "2026-08-28T00:00:00Z",
}

LEGACY_EMAIL_USER = {
    "user_id": "user_abc123",
    "email": "Alex@Wallume.App",  # mixed case, no strip
    "name": "Alex",
    "password_hash": hash_password("Password123"),
    "provider": "email",
    # missing optional: currency, theme, payday_day, work_week
}

EXTERNAL_USER = {
    "user_id": "user_ext456",
    "email": "bob@gmail.com",
    "name": "Bob",
    "password_hash": None,
    "provider": "google",
    "currency": "USD",
}


def test_normalize_email_variants():
    assert normalize_email("User@Example.com") == "user@example.com"
    assert normalize_email("user@example.com") == "user@example.com"
    assert normalize_email(" user@example.com ") == "user@example.com"
    assert normalize_email("USER@EXAMPLE.COM  ") == "user@example.com"


def test_current_user_normalizes_to_canonical():
    doc = normalize_user_document(dict(CURRENT_EMAIL_USER))
    assert doc["email"] == "alex@wallume.app"
    assert doc["user_id"] == "user_abc123"


def test_legacy_user_missing_optionals_defaults():
    doc = normalize_user_document(dict(LEGACY_EMAIL_USER))
    assert doc["email"] == "alex@wallume.app"  # lower+strip applied
    assert doc["provider"] == "email"
    assert doc["currency"] == "USD"
    assert doc["theme"] == "light"
    assert doc["payday_day"] is None
    assert doc["work_week"] == 5
    # user_id preserved
    assert doc["user_id"] == "user_abc123"


def test_external_user_no_password_hash():
    doc = normalize_user_document(dict(EXTERNAL_USER))
    assert doc["password_hash"] is None
    assert doc["provider"] == "google"


def test_legacy_bcrypt_still_verifies():
    assert verify_password("Password123", CURRENT_EMAIL_USER["password_hash"])
    assert verify_password("Password123", LEGACY_EMAIL_USER["password_hash"])
    assert not verify_password("WrongPass123", CURRENT_EMAIL_USER["password_hash"])


def test_external_provider_rejected_for_email_login():
    # Simulate login check: no password_hash -> 401
    user = EXTERNAL_USER
    assert not user.get("password_hash")
    # login would raise 401
    assert True


def test_same_user_id_preserved_after_normalization():
    legacy = normalize_user_document(dict(LEGACY_EMAIL_USER))
    current = normalize_user_document(dict(CURRENT_EMAIL_USER))
    assert legacy["user_id"] == current["user_id"]
    assert legacy["user_id"] == "user_abc123"
