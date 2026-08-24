import asyncio
import sys

sys.path.insert(0, "D:/Wallume/backend")

from app.repositories.base import BaseRepository


class _Collection:
    def __init__(self):
        self.calls = []

    async def find_one(self, *args, **kwargs):
        self.calls.append(("find_one", kwargs))
        return None

    async def insert_one(self, *args, **kwargs):
        self.calls.append(("insert_one", kwargs))

    async def update_one(self, *args, **kwargs):
        self.calls.append(("update_one", kwargs))

    async def delete_one(self, *args, **kwargs):
        self.calls.append(("delete_one", kwargs))

    async def update_many(self, *args, **kwargs):
        self.calls.append(("update_many", kwargs))

    async def delete_many(self, *args, **kwargs):
        self.calls.append(("delete_many", kwargs))


def test_base_repository_financial_operations_forward_session(monkeypatch):
    repository = BaseRepository("test")
    collection = _Collection()

    async def get_collection():
        return collection

    monkeypatch.setattr(repository, "_collection", get_collection)
    session = object()

    async def exercise():
        await repository.find_one({"id": "one"}, session=session)
        await repository.insert_one({"id": "one", "amount": 1}, session=session)
        await repository.update_one({"id": "one"}, {"$set": {"amount": 2}}, session=session)
        await repository.delete_one({"id": "one"}, session=session)
        await repository.delete_many({"id": "one"}, session=session)

    asyncio.run(exercise())
    assert all(kwargs["session"] is session for _, kwargs in collection.calls)
