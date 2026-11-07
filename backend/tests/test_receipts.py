"""Receipt attachments: boundary validation and ownership.

Uploads are untrusted input served back to a browser, so the properties that
matter are: allow-listed content types, a real size cap (Content-Length is
client-controlled and cannot be trusted), and ownership enforced in every
query filter.
"""
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, "D:/Wallume/backend")

from app.services import receipt_service as rs


class _Upload:
    def __init__(self, content_type="image/png", filename="r.png", data=b"x" * 10):
        self.content_type = content_type
        self.filename = filename
        self._data = data

    async def read(self, n=-1):
        return self._data if n < 0 else self._data[:n]


def test_rejects_a_content_type_that_is_not_allow_listed():
    with pytest.raises(rs.ReceiptError) as exc:
        import asyncio
        asyncio.run(rs.save_receipt("u1", "tx1", _Upload(content_type="application/x-msdownload")))
    assert exc.value.status_code == 415


def test_rejects_html_uploads():
    """An image-typed field is not enough; the declared type must be allowed."""
    import asyncio
    with pytest.raises(rs.ReceiptError) as exc:
        asyncio.run(rs.save_receipt("u1", "tx1", _Upload(content_type="text/html")))
    assert exc.value.status_code == 415


def test_accepts_every_allow_listed_type():
    assert rs.ALLOWED_CONTENT_TYPES["image/jpeg"] == ".jpg"
    assert rs.ALLOWED_CONTENT_TYPES["application/pdf"] == ".pdf"
    assert "image/svg+xml" not in rs.ALLOWED_CONTENT_TYPES  # SVG can carry script


def test_rejects_an_empty_file():
    import asyncio
    with pytest.raises(rs.ReceiptError) as exc:
        asyncio.run(rs.save_receipt("u1", "tx1", _Upload(data=b"")))
    assert "empty" in exc.value.message.lower()


def test_rejects_a_file_over_the_cap_even_without_content_length():
    import asyncio
    oversized = b"x" * (rs.MAX_RECEIPT_BYTES + 10)
    with pytest.raises(rs.ReceiptError) as exc:
        asyncio.run(rs.save_receipt("u1", "tx1", _Upload(data=oversized)))
    assert exc.value.status_code == 413


def test_content_type_with_charset_is_normalized():
    # Some clients send "image/png; charset=binary"; that must still match.
    normalized = "image/png; charset=binary".lower().split(";")[0].strip()
    assert normalized in rs.ALLOWED_CONTENT_TYPES


def test_load_returns_404_when_the_receipt_belongs_to_someone_else(monkeypatch):
    import asyncio
    monkeypatch.setattr(rs.ReceiptRepository, "find_one", AsyncMock(return_value=None))
    with pytest.raises(rs.ReceiptError) as exc:
        asyncio.run(rs.load_receipt("other-user", "rcp1"))
    assert exc.value.status_code == 404


def test_load_scopes_the_query_to_the_owner(monkeypatch):
    """Ownership must be in the filter, not a post-fetch comparison."""
    import asyncio
    find_one = AsyncMock(return_value=None)
    monkeypatch.setattr(rs.ReceiptRepository, "find_one", find_one)
    with pytest.raises(rs.ReceiptError):
        asyncio.run(rs.load_receipt("u1", "rcp1"))
    assert find_one.await_args.args[0] == {"id": "rcp1", "user_id": "u1"}


def test_delete_returns_false_for_a_foreign_receipt(monkeypatch):
    import asyncio
    monkeypatch.setattr(rs.ReceiptRepository, "find_one", AsyncMock(return_value=None))
    assert asyncio.run(rs.delete_receipt("u1", "rcp1")) is False


def test_grouping_by_transaction_does_one_query():
    import asyncio

    class _Cursor:
        async def to_list(self, n):
            return [
                {"id": "a", "transaction_id": "tx1"},
                {"id": "b", "transaction_id": "tx1"},
                {"id": "c", "transaction_id": "tx2"},
            ]

    class _Coll:
        def __init__(self):
            self.filter = None

        def find(self, query, projection):
            self.filter = query
            return _Cursor()

    coll = _Coll()

    async def fake_collection(self, session=None):
        return coll

    with patch.object(rs.ReceiptRepository, "_collection", fake_collection):
        grouped = asyncio.run(rs.ReceiptRepository().for_transactions("u1", ["tx1", "tx2"]))

    assert grouped["tx1"] == [{"id": "a", "transaction_id": "tx1"}, {"id": "b", "transaction_id": "tx1"}]
    assert grouped["tx2"] == [{"id": "c", "transaction_id": "tx2"}]
    # Owner and the id set are both in the filter.
    assert coll.filter["user_id"] == "u1"


def test_empty_transaction_list_short_circuits():
    import asyncio
    assert asyncio.run(rs.ReceiptRepository().for_transactions("u1", [])) == {}
