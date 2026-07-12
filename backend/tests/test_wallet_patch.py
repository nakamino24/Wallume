"""Focused regression tests for PATCH /api/wallets/{id} - iteration 2 fix verification."""
import requests

BASE_URL = "http://localhost:8001"


class TestWalletPatch:
    """Verify PATCH /api/wallets/{id} works with name, type, and balance changes."""

    def test_patch_updates_balance(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/wallets", headers=auth_headers)
        assert r.status_code == 200
        wallets = r.json()["wallets"]
        assert len(wallets) >= 1
        w = next((x for x in wallets if x["name"] == "Main Bank"), wallets[0])

        # PATCH balance
        new_balance = 9876.54
        r = requests.patch(f"{BASE_URL}/api/wallets/{w['id']}",
                           headers=auth_headers,
                           json={"name": w["name"], "type": w["type"], "balance": new_balance})
        assert r.status_code == 200, r.text
        updated = r.json()["wallet"]
        assert updated["balance"] == new_balance
        assert "_id" not in updated

        # GET verify persisted
        r = requests.get(f"{BASE_URL}/api/wallets", headers=auth_headers)
        got = next(x for x in r.json()["wallets"] if x["id"] == w["id"])
        assert got["balance"] == new_balance

    def test_patch_updates_name_and_type(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/wallets", headers=auth_headers)
        wallets = r.json()["wallets"]
        w = next((x for x in wallets if x["name"] == "Cash"), wallets[0])

        r = requests.patch(f"{BASE_URL}/api/wallets/{w['id']}",
                           headers=auth_headers,
                           json={"name": "TEST_Renamed", "type": "e_wallet", "balance": w["balance"]})
        assert r.status_code == 200, r.text
        updated = r.json()["wallet"]
        assert updated["name"] == "TEST_Renamed"
        assert updated["type"] == "e_wallet"

        # cleanup rename back
        requests.patch(f"{BASE_URL}/api/wallets/{w['id']}",
                       headers=auth_headers,
                       json={"name": "Cash", "type": "cash", "balance": w["balance"]})

    def test_patch_requires_auth(self):
        r = requests.patch(f"{BASE_URL}/api/wallets/nonexistent",
                           json={"name": "x", "type": "cash", "balance": 0})
        assert r.status_code in (401, 422)
