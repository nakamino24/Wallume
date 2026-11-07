"""Validation guards for the budget/goal/asset edit endpoints.

These three resources were create-and-delete only, so a wrong amount meant
deleting the record and re-creating it. The PATCH handlers added here must
still behave like the rest of the API: whitelist fields, reject bad money at
the boundary, and 404 on a record that isn't the caller's.
"""
import asyncio
import sys
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

sys.path.insert(0, "D:/Wallume/backend")

from app.api import resources as api


def _auth(monkeypatch):
    monkeypatch.setattr(
        api.auth_service, "get_current_user",
        AsyncMock(return_value={"user_id": "user-1", "currency": "USD"}),
    )


def test_budget_patch_updates_amount(monkeypatch):
    _auth(monkeypatch)
    update = AsyncMock()
    monkeypatch.setattr(api.budgets_repo, "update_one", update)
    monkeypatch.setattr(api.budgets_repo, "find_one", AsyncMock(return_value={"id": "bud-1", "amount": 250.0}))

    response = asyncio.run(api.update_budget("bud-1", {"amount": 250}, "Bearer t"))

    assert update.await_args.args[1] == {"$set": {"amount": 250.0}}
    assert response["data"]["budget"]["amount"] == 250.0


def test_budget_patch_rejects_negative_amount(monkeypatch):
    _auth(monkeypatch)
    monkeypatch.setattr(api.budgets_repo, "update_one", AsyncMock())
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api.update_budget("bud-1", {"amount": -10}, "Bearer t"))
    assert exc.value.status_code == 400


def test_budget_patch_ignores_unknown_fields(monkeypatch):
    _auth(monkeypatch)
    update = AsyncMock()
    monkeypatch.setattr(api.budgets_repo, "update_one", update)
    monkeypatch.setattr(api.budgets_repo, "find_one", AsyncMock(return_value={"id": "bud-1"}))

    asyncio.run(api.update_budget("bud-1", {"spent": 999, "user_id": "attacker"}, "Bearer t"))

    # No allowed keys survived, so no write should be attempted at all.
    update.assert_not_awaited()


def test_budget_patch_404s_when_not_owned(monkeypatch):
    _auth(monkeypatch)
    monkeypatch.setattr(api.budgets_repo, "update_one", AsyncMock())
    monkeypatch.setattr(api.budgets_repo, "find_one", AsyncMock(return_value=None))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api.update_budget("missing", {"amount": 10}, "Bearer t"))
    assert exc.value.status_code == 404


def test_goal_patch_updates_target(monkeypatch):
    _auth(monkeypatch)
    update = AsyncMock()
    monkeypatch.setattr(api.goals_repo, "update_one", update)
    monkeypatch.setattr(api.goals_repo, "find_one", AsyncMock(return_value={"id": "g-1", "target_amount": 5000.0}))

    asyncio.run(api.update_goal("g-1", {"target_amount": 5000, "name": "Japan"}, "Bearer t"))

    written = update.await_args.args[1]["$set"]
    assert written["target_amount"] == 5000.0
    assert written["name"] == "Japan"


def test_goal_patch_rejects_negative_saved_amount(monkeypatch):
    _auth(monkeypatch)
    monkeypatch.setattr(api.goals_repo, "update_one", AsyncMock())
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api.update_goal("g-1", {"saved_amount": -1}, "Bearer t"))
    assert exc.value.status_code == 400


def test_asset_patch_updates_value(monkeypatch):
    _auth(monkeypatch)
    update = AsyncMock()
    monkeypatch.setattr(api.assets_repo, "update_one", update)
    monkeypatch.setattr(api.assets_repo, "find_one", AsyncMock(return_value={"id": "as-1", "value": 1200.0}))

    asyncio.run(api.update_asset("as-1", {"value": 1200}, "Bearer t"))

    assert update.await_args.args[1]["$set"]["value"] == 1200.0


def test_asset_patch_rejects_non_numeric_value(monkeypatch):
    _auth(monkeypatch)
    monkeypatch.setattr(api.assets_repo, "update_one", AsyncMock())
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api.update_asset("as-1", {"value": "lots"}, "Bearer t"))
    assert exc.value.status_code == 400


def test_contribute_requires_positive_amount(monkeypatch):
    """A negative contribution would silently drain a goal."""
    _auth(monkeypatch)
    monkeypatch.setattr(api.goals_repo, "find_one", AsyncMock(return_value={"id": "g-1"}))
    monkeypatch.setattr(api.goals_repo, "update_one", AsyncMock())

    from app.schemas.models import GoalContribute

    with pytest.raises(HTTPException) as exc:
        asyncio.run(api.contribute_goal("g-1", GoalContribute(amount=-50), "Bearer t", None))
    assert exc.value.status_code == 400
