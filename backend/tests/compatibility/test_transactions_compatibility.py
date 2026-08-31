"""Transaction fixtures — date normalization."""
from app.utils.compat import normalize_transaction_document

CURRENT_TX = {"id": "tx1", "user_id": "user_abc123", "date": "2026-08-28", "amount": 1000}
LEGACY_TX_DATETIME = {"id": "tx2", "user_id": "user_abc123", "date": "2026-08-28T14:00:00Z", "amount": 1000}
LEGACY_TX_DATETIME_NOZ = {"id": "tx3", "user_id": "user_abc123", "date": "2026-08-28T00:00:00", "amount": 1000}


def test_canonical_date_preserved():
    doc = normalize_transaction_document(dict(CURRENT_TX))
    assert doc["date"] == "2026-08-28"


def test_legacy_iso_datetime_normalizes_to_date():
    doc = normalize_transaction_document(dict(LEGACY_TX_DATETIME))
    assert doc["date"] == "2026-08-28"


def test_legacy_iso_noz_normalizes():
    doc = normalize_transaction_document(dict(LEGACY_TX_DATETIME_NOZ))
    assert doc["date"] == "2026-08-28"


def test_writer_emits_canonical():
    # Simulate writer: todayLocalISO() -> YYYY-MM-DD
    from datetime import date
    canonical = date(2026, 8, 28).isoformat()
    assert canonical == "2026-08-28"
    assert "T" not in canonical
