"""Regression guards for account-deletion completeness and soft-delete isolation.

Two independent bug classes are locked down here:

1. `DELETE /auth/me` used to call `UserRepository.delete_account`, which has
   never existed — the request purged every domain collection and then raised
   AttributeError, returning 500 after the damage was already done. The purge
   list also skipped per-user auxiliary records (idempotency replay results and
   password-reset challenges), leaving data behind.
2. Every aggregation pipeline bypasses BaseRepository's `_active_filter`, so
   soft-deleted transactions kept inflating budget spend, analytics, the
   spending chart and the coach context.
"""
import sys

sys.path.insert(0, "D:/Wallume/backend")

from app.services import auth_service as auth_module
from app.services import domain_services
from app.repositories.repos import UserRepository


class _DeleteRecorder:
    def __init__(self):
        self.deleted = []

    async def delete_many(self, query):
        self.deleted.append(query)
        return object()


class _Database(dict):
    def __init__(self):
        super().__init__()
        self.recorder = _DeleteRecorder()
        self.collections_hit = []

    def __getitem__(self, name):
        self.collections_hit.append(name)
        return self.recorder


class _FakeUserRepo:
    def __init__(self):
        self.hard_deleted = []

    async def hard_delete(self, user_id):
        self.hard_deleted.append(user_id)


class _FakeAuthService(auth_module.AuthService):
    def __init__(self, user_repo):
        self.users = user_repo
        self._user = {"user_id": "user_1", "owner_id": "user_1"}

    async def get_current_user(self, authorization):
        return self._user


def _run_delete_account(monkeypatch):
    db = _Database()
    user_repo = _FakeUserRepo()

    async def fake_get_database():
        return db

    # delete_account now asks the tenancy service whether the household is
    # solo (and purges its shared data if so). That path is covered by the
    # tenancy tests; stub it here so this test stays about the purge list.
    async def solo_household(_uid):
        return False

    from app.services import tenancy_service
    monkeypatch.setattr(tenancy_service, "purge_household_if_solo", solo_household)
    monkeypatch.setattr(auth_module, "get_database", fake_get_database)
    service = _FakeAuthService(user_repo)
    import asyncio

    asyncio.run(service.delete_account("Bearer token"))
    return db.collections_hit, user_repo


def test_delete_account_does_not_call_nonexistent_repository_method(monkeypatch):
    # The old implementation raised AttributeError here; completing at all is
    # the regression assertion.
    _, user_repo = _run_delete_account(monkeypatch)
    assert user_repo.hard_deleted == ["user_1"]


def test_delete_account_purges_domain_collections(monkeypatch):
    collections, _ = _run_delete_account(monkeypatch)
    assert "wallets" in collections
    assert "transactions" in collections
    assert "users" not in collections


def test_delete_account_purges_idempotency_and_reset_challenges(monkeypatch):
    """Replayable money results and live reset codes must not survive deletion."""
    collections, _ = _run_delete_account(monkeypatch)
    assert "idempotency" in collections
    assert "password_reset_challenges" in collections


def test_user_repository_exposes_hard_delete():
    # Guards against reintroducing a call to a missing method.
    assert hasattr(UserRepository, "hard_delete")
    assert not hasattr(UserRepository, "delete_account")


def _pipeline_sources():
    """Every aggregation $match that must exclude soft-deleted transactions."""
    import inspect

    return inspect.getsource(domain_services)


def test_analytics_pipelines_exclude_soft_deleted_rows():
    source = _pipeline_sources()
    # One for the six-month trend/category breakdown, one for the chart, one
    # for the coach context.
    assert source.count('"deleted_at": None') >= 3


def test_budget_spend_excludes_soft_deleted_rows():
    from app.api import resources

    import inspect

    assert '"deleted_at": None' in inspect.getsource(resources.list_budgets)


def test_coach_context_uses_canonical_date_comparison():
    """A full-ISO comparison silently dropped the 1st of the month."""
    source = _pipeline_sources()
    assert 'month_start.isoformat()' not in source
    assert '$substr' in source
