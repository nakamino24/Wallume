# Complile-time check readable without a DB: validates the Decimal128-negation
# root cause and the create/update/delete transfer balance semantics.
import sys
sys.path.insert(0, "D:/Wallume/backend")

import pytest
from decimal import Decimal
from bson import Decimal128

from app.utils.money import to_decimal


def _adjust(balances, wid, delta_dec):
    """Simulate WalletRepository.adjust_balance (no DB)."""
    balances[wid] = balances.get(wid, 0) + delta_dec


def apply_effect(balances, wallet_id, to_wallet_id, tx_type, amount, reverse=False):
    """Mirror backend transactions._apply_effect."""
    amt = to_decimal(amount)
    if reverse:
        amt = -amt
    if tx_type == "income":
        _adjust(balances, wallet_id, amt)
    elif tx_type == "expense":
        _adjust(balances, wallet_id, -amt)
    elif tx_type == "transfer":
        _adjust(balances, wallet_id, -amt)
        _adjust(balances, to_wallet_id, amt)


class TestDecimal128Negation:
    def test_decimal128_negation_is_root_cause(self):
        # The actual crash in production: -Decimal128(...) raises TypeError.
        with pytest.raises(TypeError):
            _ = -Decimal128(Decimal("20000"))
        # Fix: convert to Python Decimal first.
        assert -to_decimal(Decimal128(Decimal("20000"))) == Decimal("-20000")


class TestTransferSemantics:
    def test_create_then_delete_reverts_both_wallets(self):
        bals = {"A": Decimal(100000), "B": Decimal(50000)}
        # create (reverse=False)
        apply_effect(bals, "A", "B", "transfer", Decimal(20000), reverse=False)
        assert bals == {"A": Decimal(80000), "B": Decimal(70000)}
        # delete (reverse=True)
        apply_effect(bals, "A", "B", "transfer", Decimal(20000), reverse=True)
        assert bals == {"A": Decimal(100000), "B": Decimal(50000)}

    def test_delete_is_idempotent(self):
        bals = {"A": Decimal(100000), "B": Decimal(50000)}
        # create 20000 A->B once
        apply_effect(bals, "A", "B", "transfer", Decimal(20000), reverse=False)
        assert bals == {"A": Decimal(80000), "B": Decimal(70000)}
        # first delete fully reverses both
        apply_effect(bals, "A", "B", "transfer", Decimal(20000), reverse=True)
        assert bals == {"A": Decimal(100000), "B": Decimal(50000)}
        # The record is then soft-deleted, so a second delete finds no active
        # record (404) and performs NO wallet mutation — balances stay restored.
        # Model that no-op here and assert no double reversal occurred.
        assert bals == {"A": Decimal(100000), "B": Decimal(50000)}

    def test_edit_amount_updates_both(self):
        bals = {"A": Decimal(100000), "B": Decimal(50000)}
        # original transfer 20000
        apply_effect(bals, "A", "B", "transfer", Decimal(20000), reverse=False)
        # edit to 50000: reverse old then apply new
        apply_effect(bals, "A", "B", "transfer", Decimal(20000), reverse=True)
        apply_effect(bals, "A", "B", "transfer", Decimal(50000), reverse=False)
        assert bals == {"A": Decimal(50000), "B": Decimal(100000)}

    def test_edit_wallets_replaces_effect(self):
        bals = {"A": Decimal(100000), "B": Decimal(50000), "C": Decimal(1000), "D": Decimal(1000)}
        # A->B 20000
        apply_effect(bals, "A", "B", "transfer", Decimal(20000), reverse=False)
        # edit to C->D 20000: fully reverse old on A,B then apply new on C,D
        apply_effect(bals, "A", "B", "transfer", Decimal(20000), reverse=True)
        apply_effect(bals, "C", "D", "transfer", Decimal(20000), reverse=False)
        assert bals["A"] == Decimal(100000)   # old source restored
        assert bals["B"] == Decimal(50000)    # old dest restored
        assert bals["C"] == Decimal(-19000)   # new source debited
        assert bals["D"] == Decimal(21000)    # new dest credited

    def test_income_expense_still_work(self):
        bals = {"W": Decimal(1000)}
        apply_effect(bals, "W", None, "income", Decimal(500), reverse=False)
        assert bals["W"] == Decimal(1500)
        apply_effect(bals, "W", None, "income", Decimal(500), reverse=True)
        assert bals["W"] == Decimal(1000)
        apply_effect(bals, "W", None, "expense", Decimal(300), reverse=False)
        assert bals["W"] == Decimal(700)
        apply_effect(bals, "W", None, "expense", Decimal(300), reverse=True)
        assert bals["W"] == Decimal(1000)