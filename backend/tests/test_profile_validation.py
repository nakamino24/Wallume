"""Profile update validation.

`PATCH /auth/me` previously took a raw dict and relied on the service's
whitelist. That meant a wrong type (e.g. `payday_day: "x"`) could reach Mongo
and 500 mid-update, and a typo'd key was silently discarded — so a client had
no way to know its change never applied.
"""
import sys
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

sys.path.insert(0, "D:/Wallume/backend")

from app.schemas.models import UserUpdateRequest


def test_valid_update_parses():
    payload = UserUpdateRequest(name="Alex", currency="IDR", theme="dark", payday_day=25, work_week=5)
    assert payload.name == "Alex"
    assert payload.currency == "IDR"


def test_unknown_fields_are_not_accepted_into_the_model():
    # Pydantic ignores extras by default; the point is they never reach the
    # service whitelist as arbitrary keys.
    payload = UserUpdateRequest(name="Alex", user_id="attacker", deleted_at="x")  # type: ignore[call-arg]
    assert not hasattr(payload, "user_id")
    assert payload.model_dump(exclude_unset=True) == {"name": "Alex"}


def test_payday_day_must_be_a_real_day():
    with pytest.raises(ValidationError):
        UserUpdateRequest(payday_day=0)
    with pytest.raises(ValidationError):
        UserUpdateRequest(payday_day=32)
    with pytest.raises(ValidationError):
        UserUpdateRequest(payday_day="not-a-number")  # type: ignore[arg-type]


def test_work_week_is_restricted_to_supported_schedules():
    for value in (5, 6, 7):
        assert UserUpdateRequest(work_week=value).work_week == value
    with pytest.raises(ValidationError):
        UserUpdateRequest(work_week=4)


def test_theme_is_restricted():
    with pytest.raises(ValidationError):
        UserUpdateRequest(theme="neon")


def test_currency_must_be_a_three_letter_code():
    with pytest.raises(ValidationError):
        UserUpdateRequest(currency="RUPIAH")


def test_exclude_unset_keeps_partial_updates_partial():
    payload = UserUpdateRequest(name="Alex")
    assert payload.model_dump(exclude_unset=True) == {"name": "Alex"}
