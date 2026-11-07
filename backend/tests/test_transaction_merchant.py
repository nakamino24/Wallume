"""Merchant field on transactions: persistence, edit-safety, normalization.

Regression guard for the data-loss bug class where a screen that navigates to
the edit route without passing `merchant` would let a blind save silently
erase the stored value — the API must round-trip the field exactly and never
drop it from PATCH unless explicitly emptied.
"""
import concurrent.futures

import pytest
import requests

BASE_URL = "http://localhost:8001"


@pytest.fixture(scope="class")
def wallet(auth_headers):
    """A dedicated funded wallet so balance assertions are isolated."""
    r = requests.post(f"{BASE_URL}/api/wallets", headers=auth_headers,
                      json={"name": "MerchantTestCash", "type": "cash", "balance": 1000})
    assert r.status_code == 200, f"wallet create failed: {r.status_code} {r.text}"
    return r.json()["data"]["wallet"]


def _balance(auth_headers, wallet_id):
    r = requests.get(f"{BASE_URL}/api/wallets", headers=auth_headers)
    return next(w for w in r.json()["data"]["wallets"] if w["id"] == wallet_id)["balance"]


def _get_tx(auth_headers, tx_id):
    r = requests.get(f"{BASE_URL}/api/transactions?limit=500", headers=auth_headers)
    return next(t for t in r.json()["data"]["transactions"] if t["id"] == tx_id)


class TestTransactionMerchant:
    def _create_tx(self, auth_headers, wallet, **overrides):
        payload = {"wallet_id": wallet["id"], "type": "expense",
                   "amount": 10, "category": "Food"}
        payload.update(overrides)
        r = requests.post(f"{BASE_URL}/api/transactions", headers=auth_headers, json=payload)
        assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
        return r.json()["data"]["transaction"]

    def test_create_with_merchant_persists(self, auth_headers, wallet):
        tx = self._create_tx(auth_headers, wallet, merchant="Starbucks")
        assert tx["merchant"] == "Starbucks"
        assert _get_tx(auth_headers, tx["id"])["merchant"] == "Starbucks"

    def test_create_without_merchant_defaults_empty(self, auth_headers, wallet):
        # Legacy clients omit merchant entirely; stored doc must still carry
        # a string so list views can rely on t.merchant always existing.
        tx = self._create_tx(auth_headers, wallet)
        assert tx["merchant"] == ""

    def test_patch_updates_merchant(self, auth_headers, wallet):
        tx = self._create_tx(auth_headers, wallet, merchant="Old")
        r = requests.patch(f"{BASE_URL}/api/transactions/{tx['id']}",
                           headers=auth_headers, json={"merchant": "New Cafe"})
        assert r.status_code == 200
        assert r.json()["data"]["transaction"]["merchant"] == "New Cafe"
        assert _get_tx(auth_headers, tx["id"])["merchant"] == "New Cafe"

    def test_patch_without_merchant_preserves_value(self, auth_headers, wallet):
        """THE regression: an edit-screen save that omits merchant (e.g. a
        call site that didn't pass it as a route param) must NOT erase it."""
        tx = self._create_tx(auth_headers, wallet, merchant="Keep Me")
        r = requests.patch(f"{BASE_URL}/api/transactions/{tx['id']}",
                           headers=auth_headers,
                           json={"note": "touched note only", "amount": 12})
        assert r.status_code == 200
        assert r.json()["data"]["transaction"]["merchant"] == "Keep Me"
        assert _get_tx(auth_headers, tx["id"])["merchant"] == "Keep Me"

    def test_patch_explicit_empty_erases(self, auth_headers, wallet):
        tx = self._create_tx(auth_headers, wallet, merchant="Erase Me")
        r = requests.patch(f"{BASE_URL}/api/transactions/{tx['id']}",
                           headers=auth_headers, json={"merchant": ""})
        assert r.status_code == 200
        assert r.json()["data"]["transaction"]["merchant"] == ""
        assert _get_tx(auth_headers, tx["id"])["merchant"] == ""

    def test_create_trims_whitespace(self, auth_headers, wallet):
        tx = self._create_tx(auth_headers, wallet, merchant="   Padded Brand   ")
        assert tx["merchant"] == "Padded Brand"

    def test_create_caps_length_at_120(self, auth_headers, wallet):
        tx = self._create_tx(auth_headers, wallet, merchant="x" * 500)
        assert len(tx["merchant"]) == 120

    def test_patch_null_normalizes_to_empty(self, auth_headers, wallet):
        tx = self._create_tx(auth_headers, wallet, merchant="Something")
        r = requests.patch(f"{BASE_URL}/api/transactions/{tx['id']}",
                           headers=auth_headers, json={"merchant": None})
        assert r.status_code == 200
        assert r.json()["data"]["transaction"]["merchant"] == ""

    def test_metadata_only_edits_never_touch_balance(self, auth_headers, wallet):
        """Invariant guard for the skip-rewrite optimization: edits to fields
        that cannot affect the wallet effect (merchant/note/date/category)
        must leave the balance bit-exact, individually and combined."""
        r = requests.post(f"{BASE_URL}/api/transactions", headers=auth_headers,
                          json={"wallet_id": wallet["id"], "type": "expense",
                                "amount": 13.37, "category": "Food", "merchant": "InvCo"})
        assert r.status_code == 200
        tx_id = r.json()["data"]["transaction"]["id"]
        baseline = _balance(auth_headers, wallet["id"])

        for payload in (
            {"merchant": "Renamed Co"},
            {"note": "just a note"},
            {"date": "2026-01-15"},
            {"category": "Groceries"},
            {"merchant": "All At Once", "note": "n2", "category": "Bills"},
        ):
            pr = requests.patch(f"{BASE_URL}/api/transactions/{tx_id}",
                                headers=auth_headers, json=payload)
            assert pr.status_code == 200, f"{payload}: {pr.text}"
            assert _balance(auth_headers, wallet["id"]) == baseline, \
                f"balance drifted after metadata-only edit: {payload}"


class TestMerchantStress:
    """Rapid-fire and concurrent edits: merchant must survive churn and
    wallet balances must stay exact under repeated patch cycles."""

    def test_rapid_edit_cycles_preserve_merchant_and_balance(self, auth_headers, wallet):
        before = _balance(auth_headers, wallet["id"])
        r = requests.post(f"{BASE_URL}/api/transactions", headers=auth_headers,
                          json={"wallet_id": wallet["id"], "type": "expense",
                                "amount": 5, "category": "Food", "merchant": "v0"})
        assert r.status_code == 200
        tx_id = r.json()["data"]["transaction"]["id"]

        for i in range(25):
            pr = requests.patch(f"{BASE_URL}/api/transactions/{tx_id}",
                                headers=auth_headers,
                                json={"note": f"cycle {i}", "merchant": f"brand-{i}"})
            assert pr.status_code == 200
            assert pr.json()["data"]["transaction"]["merchant"] == f"brand-{i}"

        after = _balance(auth_headers, wallet["id"])
        assert round(before - after, 2) == 5.0
        final = _get_tx(auth_headers, tx_id)
        assert final["merchant"] == "brand-24"
        assert final["note"] == "cycle 24"

    def test_concurrent_patches_last_write_wins_no_corruption(self, auth_headers, wallet):
        before = _balance(auth_headers, wallet["id"])
        r = requests.post(f"{BASE_URL}/api/transactions", headers=auth_headers,
                          json={"wallet_id": wallet["id"], "type": "expense",
                                "amount": 7, "category": "Food", "merchant": "start"})
        assert r.status_code == 200
        tx_id = r.json()["data"]["transaction"]["id"]

        def patch(i):
            return requests.patch(f"{BASE_URL}/api/transactions/{tx_id}",
                                  headers=auth_headers,
                                  json={"merchant": f"racer-{i}"})

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(patch, i) for i in range(16)]
            results = [f.result() for f in futures]
        # 16 writers race on ONE tx document, so MongoDB WriteConflicts are
        # expected; the server retries transients and may legitimately answer
        # 409 (retry signal) after exhausting backoff. A 500 is never OK.
        bad = [r.status_code for r in results if r.status_code not in (200, 409)]
        assert not bad, f"non-200/409 statuses under contention: {bad}"
        succeeded = sum(1 for r in results if r.status_code == 200)
        assert succeeded >= 1

        final = _get_tx(auth_headers, tx_id)
        # Last-write-wins: whatever persisted must be one of the racers' values.
        if succeeded > 0:
            assert final["merchant"].startswith("racer-")

        after = _balance(auth_headers, wallet["id"])
        assert round(before - after, 2) == 7.0
