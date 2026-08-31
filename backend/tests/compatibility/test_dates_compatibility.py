"""Date fixtures — canonical vs historical."""
from datetime import date

from app.utils.compat import normalize_transaction_document


def test_canonical_yyyy_mm_dd():
    assert normalize_transaction_document({"date": "2026-08-28"})["date"] == "2026-08-28"


def test_historical_with_time():
    assert normalize_transaction_document({"date": "2026-08-28T14:30:00"})["date"] == "2026-08-28"


def test_historical_with_z():
    assert normalize_transaction_document({"date": "2026-08-28T14:30:00Z"})["date"] == "2026-08-28"


def test_no_timezone_fabrication():
    # Normalization keeps calendar date, does not shift day
    doc = normalize_transaction_document({"date": "2026-08-28T00:00:00"})
    assert doc["date"] == "2026-08-28"
    # Writer
    assert date.today().isoformat().count("-") == 2
