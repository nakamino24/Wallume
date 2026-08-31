"""Money fixtures — legacy int/float/string vs canonical Decimal128."""
from decimal import Decimal
from bson import Decimal128
from app.repositories.base import BaseRepository
from app.utils.money import to_decimal128, from_decimal128

LEGACY_INT = 150000
LEGACY_FLOAT = 150000.75
LEGACY_DECIMAL128 = Decimal128(Decimal("150000.75"))


def test_repository_read_normalizes_historical_and_current_money():
    repo = BaseRepository("wallets")
    for value, expected in [
        (LEGACY_INT, 150000),
        (LEGACY_FLOAT, 150000.75),
        (LEGACY_DECIMAL128, 150000.75),
    ]:
        assert repo._money_out({"balance": value})["balance"] == expected


def test_canonical_writer_is_decimal128():
    d128 = to_decimal128(150000.75)
    assert isinstance(d128, Decimal128)
    # Round-trip via from_decimal128 -> float 2 decimals
    assert from_decimal128(d128) == 150000.75


def test_new_write_always_decimal128():
    for v in [150000, 150000.75, "150000.75", Decimal("150000.75")]:
        assert isinstance(to_decimal128(v), Decimal128)


def test_repository_write_uses_decimal128():
    doc = BaseRepository("transactions")._money_in({"amount": 150000.75})
    assert isinstance(doc["amount"], Decimal128)
