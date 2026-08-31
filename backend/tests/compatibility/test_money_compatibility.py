"""Money fixtures — legacy int/float/string vs canonical Decimal128."""
from decimal import Decimal
from bson import Decimal128
from app.utils.money import to_decimal, to_decimal128, from_decimal128
from app.utils.compat import normalize_money_value

LEGACY_INT = 150000
LEGACY_FLOAT = 150000.75
LEGACY_STRING = "150000.75"
LEGACY_DECIMAL = Decimal("150000.75")
LEGACY_DECIMAL128 = Decimal128(Decimal("150000.75"))


def test_legacy_int_normalizes():
    d = normalize_money_value(LEGACY_INT)
    assert d == Decimal("150000")


def test_legacy_float_normalizes():
    d = normalize_money_value(LEGACY_FLOAT)
    assert d == Decimal("150000.75")


def test_legacy_string_normalizes():
    d = normalize_money_value(LEGACY_STRING)
    assert d == Decimal("150000.75")


def test_legacy_decimal_passthrough():
    d = normalize_money_value(LEGACY_DECIMAL)
    assert d == Decimal("150000.75")


def test_legacy_decimal128_normalizes():
    d = normalize_money_value(LEGACY_DECIMAL128)
    assert d == Decimal("150000.75")


def test_canonical_writer_is_decimal128():
    d128 = to_decimal128(150000.75)
    assert isinstance(d128, Decimal128)
    # Round-trip via from_decimal128 -> float 2 decimals
    assert from_decimal128(d128) == 150000.75


def test_new_write_always_decimal128():
    for v in [150000, 150000.75, "150000.75", Decimal("150000.75")]:
        assert isinstance(to_decimal128(v), Decimal128)
