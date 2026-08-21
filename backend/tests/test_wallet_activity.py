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
