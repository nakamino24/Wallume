import asyncio
import sys

sys.path.insert(0, "D:/Wallume/backend")

from app.repositories.repos import WalletRepository


class _Collection:
    def __init__(self):
        self.calls = []

    async def update_one(self, query, update, **kwargs):
        self.calls.append((query, update, kwargs))


def test_adjust_balance_forwards_session_to_motor(monkeypatch):
    repository = WalletRepository()
    collection = _Collection()

    async def get_collection(session=None):
        return collection

    monkeypatch.setattr(repository, "_collection", get_collection)
    session = object()
    asyncio.run(repository.adjust_balance("wallet_1", "user_1", 12.5, session=session))

    assert collection.calls[0][2]["session"] is session
