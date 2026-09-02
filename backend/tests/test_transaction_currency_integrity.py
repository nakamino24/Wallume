import asyncio
from unittest.mock import AsyncMock

from app.api import transactions


def test_transaction_list_preserves_raw_amount_and_adds_home_currency_value(monkeypatch):
    monkeypatch.setattr(
        transactions.auth_service,
        "get_current_user",
        AsyncMock(return_value={"user_id": "user-1", "currency": "IDR"}),
    )
    monkeypatch.setattr(
        transactions.txs,
        "find_by_user",
        AsyncMock(return_value=[{"id": "tx-1", "wallet_id": "wallet-usd", "amount": 20_000.0}]),
    )
    monkeypatch.setattr(
        transactions.wallets,
        "find_by_user",
        AsyncMock(return_value=[{"id": "wallet-usd", "currency": "USD"}]),
    )
    convert = AsyncMock(return_value=357_125_000.0)
    monkeypatch.setattr(transactions.FxService, "convert", convert)

    response = asyncio.run(transactions.list_transactions(authorization="Bearer token"))
    item = response["data"]["transactions"][0]

    assert item["amount"] == 20_000.0
    assert item["currency"] == "USD"
    assert item["converted_amount"] == 357_125_000.0
    assert item["home_currency"] == "IDR"
    convert.assert_awaited_once_with(20_000.0, "USD", "IDR")


def test_cross_currency_transfer_converts_destination_wallet_effect(monkeypatch):
    async def find_wallet(query, _session):
        if query["id"] == "wallet-usd":
            return {"id": "wallet-usd", "currency": "USD"}
        return {"id": "wallet-idr", "currency": "IDR"}

    adjust = AsyncMock()
    monkeypatch.setattr(transactions.wallets, "find_one", find_wallet)
    monkeypatch.setattr(transactions.wallets, "adjust_balance", adjust)
    async def convert(amount, from_currency, to_currency):
        if from_currency == to_currency:
            return amount
        return 17_856.25

    monkeypatch.setattr(transactions.FxService, "convert", convert)

    asyncio.run(
        transactions._apply_effect(
            "user-1", "wallet-usd", "wallet-idr", "transfer", 1, object(),
            reverse=False, tx_currency="USD",
        )
    )

    assert adjust.await_count == 2
    assert adjust.await_args_list[0].args[0:3] == ("wallet-usd", "user-1", transactions.to_decimal(-1))
    assert adjust.await_args_list[1].args[0:3] == ("wallet-idr", "user-1", transactions.to_decimal(17_856.25))


def test_idr_input_updates_usd_wallet_by_equivalent_value(monkeypatch):
    monkeypatch.setattr(
        transactions.wallets,
        "find_one",
        AsyncMock(return_value={"id": "wallet-usd", "currency": "USD"}),
    )
    adjust = AsyncMock()
    monkeypatch.setattr(transactions.wallets, "adjust_balance", adjust)
    convert = AsyncMock(return_value=1.12)
    monkeypatch.setattr(transactions.FxService, "convert", convert)

    asyncio.run(
        transactions._apply_effect(
            "user-1", "wallet-usd", None, "income", 20_000, object(),
            reverse=False, tx_currency="IDR",
        )
    )

    convert.assert_awaited_once_with(20_000.0, "IDR", "USD")
    assert adjust.await_args.args[0:3] == ("wallet-usd", "user-1", transactions.to_decimal(1.12))


def test_reverse_uses_stored_wallet_amount_not_a_new_exchange_rate(monkeypatch):
    monkeypatch.setattr(
        transactions.wallets,
        "find_one",
        AsyncMock(return_value={"id": "wallet-usd", "currency": "USD"}),
    )
    adjust = AsyncMock()
    monkeypatch.setattr(transactions.wallets, "adjust_balance", adjust)
    convert = AsyncMock(side_effect=AssertionError("reverse must not fetch a fresh FX rate"))
    monkeypatch.setattr(transactions.FxService, "convert", convert)

    asyncio.run(
        transactions._apply_effect(
            "user-1", "wallet-usd", None, "income", 20_000, object(),
            reverse=True, tx_currency="IDR", wallet_amount=1.12,
        )
    )

    convert.assert_not_awaited()
    assert adjust.await_args.args[0:3] == ("wallet-usd", "user-1", transactions.to_decimal(-1.12))
