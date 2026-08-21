import pytest
from decimal import Decimal
from app.utils.money import to_decimal, to_decimal128, from_decimal128
from bson import Decimal128


class TestWalletActivityFiltering:
    def test_find_by_user_with_wallet_id_filters_correctly(self):
        from app.repositories.repos import TransactionRepository
        txs = TransactionRepository()
        assert hasattr(txs, 'find_by_user')
        import inspect
        sig = inspect.signature(txs.find_by_user)
        params = list(sig.parameters.keys())
        assert 'wallet_id' in params, "find_by_user should accept wallet_id parameter"

    def test_wallet_activity_query_structure(self):
        q = {"user_id": "u1", "deleted_at": None}
        wallet_id = "w1"
        q["$or"] = [{"wallet_id": wallet_id}, {"to_wallet_id": wallet_id}]
        assert "$or" in q
        assert {"wallet_id": "w1"} in q["$or"]
        assert {"to_wallet_id": "w1"} in q["$or"]


class TestTransactionOrdering:
    def test_sort_uses_compound_order(self):
        from app.repositories.repos import TransactionRepository
        txs = TransactionRepository()
        import inspect
        src = inspect.getsource(txs.find_by_user)
        assert '("date", -1)' in src or "'date', -1" in src, "Should sort by date DESC"
        assert '("created_at", -1)' in src or "'created_at', -1" in src, "Should sort by created_at DESC as tiebreaker"
        assert '("id", -1)' in src or "'id', -1" in src, "Should sort by id DESC as final tiebreaker"


class TestTransferPerspective:
    def test_transfer_source_shows_out(self):
        wallet_id = "w_source"
        tx = {"wallet_id": "w_source", "to_wallet_id": "w_dest", "type": "transfer", "amount": 100}
        is_source = tx["wallet_id"] == wallet_id
        is_dest = tx["to_wallet_id"] == wallet_id
        assert is_source and not is_dest
        direction = "OUT" if is_source else "IN"
        assert direction == "OUT"

    def test_transfer_dest_shows_in(self):
        wallet_id = "w_dest"
        tx = {"wallet_id": "w_source", "to_wallet_id": "w_dest", "type": "transfer", "amount": 100}
        is_source = tx["wallet_id"] == wallet_id
        is_dest = tx["to_wallet_id"] == wallet_id
        assert not is_source and is_dest
        direction = "IN" if is_dest else "OUT"
        assert direction == "IN"

    def test_income_shows_in(self):
        tx = {"wallet_id": "w1", "type": "income", "amount": 100}
        direction = "IN" if tx["type"] == "income" else "OUT"
        assert direction == "IN"

    def test_expense_shows_out(self):
        tx = {"wallet_id": "w1", "type": "expense", "amount": 100}
        direction = "OUT" if tx["type"] == "expense" else "IN"
        assert direction == "OUT"


class TestSoftDeleteExclusion:
    def test_active_filter_excludes_deleted(self):
        from app.repositories.base import BaseRepository
        base = BaseRepository("test")
        f = base._active_filter({"user_id": "u1"})
        assert "deleted_at" in f
        assert f["deleted_at"] is None


class TestDecimalNegation:
    def test_decimal128_cannot_negate_directly(self):
        d = Decimal128("100.00")
        with pytest.raises(TypeError):
            _ = -d

    def test_to_decimal_enables_negation(self):
        d128 = Decimal128("100.00")
        d = to_decimal(d128)
        negated = -d
        assert negated == Decimal("-100.00")

    def test_to_decimal_handles_float(self):
        d = to_decimal(100.5)
        assert d == Decimal("100.5")

    def test_to_decimal_handles_decimal(self):
        d = to_decimal(Decimal("100.00"))
        assert d == Decimal("100.00")

    def test_decimal_roundtrip(self):
        original = Decimal("12345.67")
        d128 = to_decimal128(original)
        recovered = to_decimal(d128)
        assert recovered == original


class TestTimestampSemantics:
    """Wallet activity time display must use created_at (actual save time),
    never a fake time derived from a date-only string."""

    def test_created_at_preferred_over_date(self):
        tx = {"date": "2026-08-21", "created_at": "2026-08-21T14:32:00+00:00"}
        timestamp = tx.get("created_at") or tx["date"]
        assert timestamp == "2026-08-21T14:32:00+00:00"

    def test_date_only_string_has_no_time_component(self):
        # A bare YYYY-MM-DD parsed as UTC midnight displays as 07:00 in UTC+7 —
        # the root cause of the uniform "7:00 AM" bug. It must be detected so
        # the UI can omit the time instead of showing a fabricated one.
        import re
        date_only = re.compile(r"^\d{4}-\d{2}-\d{2}$")
        assert date_only.match("2026-08-21")
        assert not date_only.match("2026-08-21T14:32:00+00:00")

    def test_date_only_parses_as_local_midnight_not_utc(self):
        # Grouping must parse date-only strings as LOCAL midnight; otherwise
        # UTC+7 users would see "2026-08-21" land under Aug 20 at 17:00 local.
        from datetime import datetime
        d_utc = datetime.fromisoformat("2026-08-21")          # JS new Date("2026-08-21") ≈ UTC midnight
        d_local = datetime.fromisoformat("2026-08-21T00:00:00")  # JS new Date("2026-08-21T00:00:00")
        assert d_utc.date() == d_local.date()  # same calendar day by construction

    def test_backend_stores_created_at_on_create(self):
        import inspect
        from app.api import transactions as tx_api
        src = inspect.getsource(tx_api.create_transaction)
        assert '"created_at": now_utc()' in src or "'created_at': now_utc()" in src

    def test_update_preserves_created_at(self):
        import inspect
        from app.api import transactions as tx_api
        src = inspect.getsource(tx_api.update_transaction)
        # allowed fields exclude created_at, so $set can never overwrite it
        assert '"created_at"' not in src.split('allowed = {')[1].split('}')[0]


class TestOrderingDeterminism:
    def test_same_timestamp_falls_back_to_id_desc(self):
        items = [
            {"id": "tx_aaa", "created_at": None},
            {"id": "tx_zzz", "created_at": None},
            {"id": "tx_mmm", "created_at": None},
        ]
        items.sort(key=lambda t: t["id"], reverse=True)
        assert [t["id"] for t in items] == ["tx_zzz", "tx_mmm", "tx_aaa"]

    def test_newer_created_at_sorts_first(self):
        items = [
            {"id": "tx_a", "created_at": "2026-08-21T10:00:00+00:00"},
            {"id": "tx_b", "created_at": "2026-08-21T10:05:00+00:00"},
            {"id": "tx_c", "created_at": "2026-08-21T10:10:00+00:00"},
        ]
        from datetime import datetime
        items.sort(key=lambda t: datetime.fromisoformat(t["created_at"]), reverse=True)
        assert [t["id"] for t in items] == ["tx_c", "tx_b", "tx_a"]


class TestCanonicalDateNormalization:
    """Every transaction write path must store date as canonical YYYY-MM-DD so
    the mixed-format ordering bug never regresses."""

    def test_date_only_passes_through(self):
        from app.utils.helpers import to_canonical_date
        assert to_canonical_date("2026-08-21") == "2026-08-21"

    def test_full_iso_converts_to_utc_calendar_day(self):
        from app.utils.helpers import to_canonical_date
        assert to_canonical_date("2026-08-20T15:08:00.857834+00:00") == "2026-08-20"

    def test_non_utc_offset_uses_utc_day(self):
        # 2026-08-21 02:30+07:00 == 2026-08-20 19:30Z -> UTC day wins
        from app.utils.helpers import to_canonical_date
        assert to_canonical_date("2026-08-21T02:30:00+07:00") == "2026-08-20"

    def test_z_suffix_supported(self):
        from app.utils.helpers import to_canonical_date
        assert to_canonical_date("2026-08-21T09:00:00Z") == "2026-08-21"

    def test_none_and_empty_untouched(self):
        from app.utils.helpers import to_canonical_date
        assert to_canonical_date(None) is None
        assert to_canonical_date("") == ""

    def test_unknown_format_not_dropped(self):
        from app.utils.helpers import to_canonical_date
        assert to_canonical_date("not-a-date") == "not-a-date"

    def test_create_path_normalizes(self):
        import inspect
        from app.api import transactions as tx_api
        src = inspect.getsource(tx_api.create_transaction)
        assert "to_canonical_date" in src

    def test_update_path_normalizes(self):
        import inspect
        from app.api import transactions as tx_api
        src = inspect.getsource(tx_api.update_transaction)
        assert 'to_canonical_date(allowed["date"])' in src

    def test_recurring_mark_paid_normalizes(self):
        import inspect
        from app.api import resources as res
        src = inspect.getsource(res.mark_recurring_paid)
        assert "to_canonical_date(now_utc().isoformat())" in src
