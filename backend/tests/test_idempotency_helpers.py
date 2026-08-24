import sys
import asyncio

import pytest
from fastapi import HTTPException

sys.path.insert(0, "D:/Wallume/backend")

from app.api.transactions import _find_idempotency_result, _idempotency_fingerprint


class _Collection:
    def __init__(self, record=None):
        self.record = record

    async def find_one(self, query):
        return self.record


class _Database:
    def __init__(self, record=None):
        self.idempotency = _Collection(record)


def test_fingerprint_ignores_transport_mutation_id():
    first = _idempotency_fingerprint("PATCH /transactions", "tx_1", {"amount": 10, "client_mutation_id": "one"})
    second = _idempotency_fingerprint("PATCH /transactions", "tx_1", {"amount": 10, "client_mutation_id": "two"})
    assert first == second


def test_fingerprint_binds_operation_resource_and_payload():
    base = _idempotency_fingerprint("PATCH /transactions", "tx_1", {"amount": 10})
    assert base != _idempotency_fingerprint("PATCH /transactions", "tx_2", {"amount": 10})
    assert base != _idempotency_fingerprint("DELETE /transactions", "tx_1", {})
    assert base != _idempotency_fingerprint("PATCH /transactions", "tx_1", {"amount": 20})


def test_same_mutation_id_cannot_cross_resource_types():
    transaction = _idempotency_fingerprint("POST /transactions", "", {"wallet_id": "wallet_1", "amount": 10})
    wallet = _idempotency_fingerprint("POST /wallets", "", {"wallet_id": "wallet_1", "amount": 10})
    assert transaction != wallet


def test_missing_mutation_record_is_not_a_replay():
    result = asyncio.run(_find_idempotency_result(_Database(), "user_1", "mutation_1", "fingerprint"))
    assert result == (False, None)


def test_completed_delete_replays_none_result():
    record = {"fingerprint": "fingerprint", "result": None}
    result = asyncio.run(_find_idempotency_result(_Database(record), "user_1", "mutation_1", "fingerprint"))
    assert result == (True, None)


def test_mutation_id_cannot_be_reused_for_different_request():
    record = {"fingerprint": "original", "result": {"transaction": {"id": "tx_1"}}}
    with pytest.raises(HTTPException) as exc:
        asyncio.run(_find_idempotency_result(_Database(record), "user_1", "mutation_1", "different"))
    assert exc.value.status_code == 409
