"""Backend API tests for Matrix Finance."""
import json
import time
import pytest
import requests

BASE_URL = "http://localhost:8001"


# ----------------- Health -----------------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ----------------- Auth -----------------
class TestAuth:
    def test_signup_seeds_and_returns_jwt(self, auth_user, auth_headers):
        # Verify JWT present
        assert auth_user["token"]
        # verify seed data (2 wallets + 4 budgets)
        r = requests.get(f"{BASE_URL}/api/wallets", headers=auth_headers)
        assert r.status_code == 200
        wallets = r.json()["wallets"]
        assert len(wallets) == 2, f"expected 2 seeded wallets, got {len(wallets)}"
        names = {w["name"] for w in wallets}
        assert {"Cash", "Main Bank"}.issubset(names)
        # no _id leak
        assert all("_id" not in w for w in wallets)

        r = requests.get(f"{BASE_URL}/api/budgets", headers=auth_headers)
        assert r.status_code == 200
        budgets = r.json()["budgets"]
        assert len(budgets) == 4, f"expected 4 seeded budgets, got {len(budgets)}"
        assert all("_id" not in b for b in budgets)
        # spent field computed
        assert all("spent" in b for b in budgets)

    def test_signup_duplicate_email(self, api_client, auth_user):
        r = api_client.post(f"{BASE_URL}/api/auth/signup",
                            json={"name": "Dup", "email": auth_user["email"], "password": "password123"})
        assert r.status_code == 400

    def test_login_success(self, api_client, auth_user):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": auth_user["email"], "password": auth_user["password"]})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and "user" in d
        assert d["user"]["email"] == auth_user["email"]
        assert "password_hash" not in d["user"]

    def test_login_bad_password(self, api_client, auth_user):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": auth_user["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_token(self, auth_headers, auth_user):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == auth_user["email"]

    def test_me_without_token_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_patch_me(self, auth_headers):
        r = requests.patch(f"{BASE_URL}/api/auth/me", headers=auth_headers,
                           json={"name": "Alex Updated", "currency": "EUR", "theme": "light"})
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["name"] == "Alex Updated"
        assert u["currency"] == "EUR"
        assert u["theme"] == "light"

    def test_logout(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/auth/logout", headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ----------------- Wallets -----------------
class TestWallets:
    def test_create_wallet_and_verify(self, auth_headers):
        payload = {"name": "TEST_CC", "type": "credit_card", "balance": 100.0, "currency": "USD"}
        r = requests.post(f"{BASE_URL}/api/wallets", headers=auth_headers, json=payload)
        assert r.status_code == 200
        w = r.json()["wallet"]
        assert w["name"] == "TEST_CC" and w["type"] == "credit_card"
        assert "_id" not in w
        # Verify via GET
        r2 = requests.get(f"{BASE_URL}/api/wallets", headers=auth_headers)
        assert any(x["id"] == w["id"] for x in r2.json()["wallets"])

    def test_wallet_types_supported(self, auth_headers):
        for t in ("cash", "bank", "credit_card", "e_wallet", "savings", "investment"):
            r = requests.post(f"{BASE_URL}/api/wallets", headers=auth_headers,
                              json={"name": f"TEST_{t}", "type": t, "balance": 0})
            assert r.status_code == 200, f"type {t} failed: {r.text}"
            # cleanup
            wid = r.json()["wallet"]["id"]
            requests.delete(f"{BASE_URL}/api/wallets/{wid}", headers=auth_headers)

    def test_delete_wallet_removes_transactions(self, auth_headers):
        # create wallet
        r = requests.post(f"{BASE_URL}/api/wallets", headers=auth_headers,
                          json={"name": "TEST_DEL", "type": "cash", "balance": 500})
        wid = r.json()["wallet"]["id"]
        # add tx
        rtx = requests.post(f"{BASE_URL}/api/transactions", headers=auth_headers,
                            json={"wallet_id": wid, "type": "expense", "amount": 10, "category": "Food"})
        assert rtx.status_code == 200
        tx_id = rtx.json()["transaction"]["id"]
        # delete wallet
        rd = requests.delete(f"{BASE_URL}/api/wallets/{wid}", headers=auth_headers)
        assert rd.status_code == 200
        # verify wallet gone
        wr = requests.get(f"{BASE_URL}/api/wallets", headers=auth_headers)
        assert not any(w["id"] == wid for w in wr.json()["wallets"])
        # verify transaction gone
        tr = requests.get(f"{BASE_URL}/api/transactions", headers=auth_headers)
        assert not any(t["id"] == tx_id for t in tr.json()["transactions"])


# ----------------- Transactions -----------------
class TestTransactions:
    def _get_wallet(self, auth_headers, name="Cash"):
        r = requests.get(f"{BASE_URL}/api/wallets", headers=auth_headers)
        for w in r.json()["wallets"]:
            if w["name"] == name:
                return w
        return r.json()["wallets"][0]

    def test_income_adds_balance(self, auth_headers):
        w = self._get_wallet(auth_headers, "Cash")
        before = w["balance"]
        r = requests.post(f"{BASE_URL}/api/transactions", headers=auth_headers,
                          json={"wallet_id": w["id"], "type": "income",
                                "amount": 100, "category": "Salary"})
        assert r.status_code == 200
        w2 = self._get_wallet(auth_headers, "Cash")
        assert round(w2["balance"] - before, 2) == 100.0

    def test_expense_subtracts_balance(self, auth_headers):
        w = self._get_wallet(auth_headers, "Cash")
        before = w["balance"]
        r = requests.post(f"{BASE_URL}/api/transactions", headers=auth_headers,
                          json={"wallet_id": w["id"], "type": "expense",
                                "amount": 25, "category": "Food"})
        assert r.status_code == 200
        w2 = self._get_wallet(auth_headers, "Cash")
        assert round(before - w2["balance"], 2) == 25.0

    def test_transfer_requires_to_wallet(self, auth_headers):
        w = self._get_wallet(auth_headers, "Cash")
        r = requests.post(f"{BASE_URL}/api/transactions", headers=auth_headers,
                          json={"wallet_id": w["id"], "type": "transfer",
                                "amount": 10, "category": "Transfer"})
        assert r.status_code == 400

    def test_transfer_moves_amount(self, auth_headers):
        w1 = self._get_wallet(auth_headers, "Cash")
        w2 = self._get_wallet(auth_headers, "Main Bank")
        b1, b2 = w1["balance"], w2["balance"]
        r = requests.post(f"{BASE_URL}/api/transactions", headers=auth_headers,
                          json={"wallet_id": w1["id"], "to_wallet_id": w2["id"],
                                "type": "transfer", "amount": 50, "category": "Transfer"})
        assert r.status_code == 200
        w1b = self._get_wallet(auth_headers, "Cash")
        w2b = self._get_wallet(auth_headers, "Main Bank")
        assert round(b1 - w1b["balance"], 2) == 50.0
        assert round(w2b["balance"] - b2, 2) == 50.0

    def test_filter_by_type(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/transactions?type=expense", headers=auth_headers)
        assert r.status_code == 200
        txs = r.json()["transactions"]
        assert all(t["type"] == "expense" for t in txs)

    def test_delete_reverses_balance(self, auth_headers):
        w = self._get_wallet(auth_headers, "Cash")
        before = w["balance"]
        r = requests.post(f"{BASE_URL}/api/transactions", headers=auth_headers,
                          json={"wallet_id": w["id"], "type": "expense",
                                "amount": 30, "category": "Test"})
        tx_id = r.json()["transaction"]["id"]
        rd = requests.delete(f"{BASE_URL}/api/transactions/{tx_id}", headers=auth_headers)
        assert rd.status_code == 200
        wafter = self._get_wallet(auth_headers, "Cash")
        assert round(wafter["balance"], 2) == round(before, 2)


# ----------------- Budgets -----------------
class TestBudgets:
    def test_create_and_spent_computed(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/budgets", headers=auth_headers,
                          json={"category": "TestCatBudget", "amount": 500, "period": "monthly"})
        assert r.status_code == 200
        bid = r.json()["budget"]["id"]
        # create a same-month expense in that category
        wr = requests.get(f"{BASE_URL}/api/wallets", headers=auth_headers)
        w = wr.json()["wallets"][0]
        requests.post(f"{BASE_URL}/api/transactions", headers=auth_headers,
                      json={"wallet_id": w["id"], "type": "expense",
                            "amount": 42.5, "category": "TestCatBudget"})
        gb = requests.get(f"{BASE_URL}/api/budgets", headers=auth_headers)
        assert gb.status_code == 200
        target = next(b for b in gb.json()["budgets"] if b["id"] == bid)
        assert target["spent"] >= 42.5


# ----------------- Goals -----------------
class TestGoals:
    def test_create_goal_and_contribute(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/goals", headers=auth_headers,
                          json={"name": "Emergency Fund", "target_amount": 5000,
                                "saved_amount": 100, "kind": "emergency"})
        assert r.status_code == 200
        g = r.json()["goal"]
        assert g["kind"] == "emergency"
        rc = requests.post(f"{BASE_URL}/api/goals/{g['id']}/contribute",
                           headers=auth_headers, json={"amount": 250})
        assert rc.status_code == 200
        assert rc.json()["goal"]["saved_amount"] == 350

    def test_goal_kinds(self, auth_headers):
        for kind in ("general", "emergency", "car", "vacation", "education", "gadget", "business"):
            r = requests.post(f"{BASE_URL}/api/goals", headers=auth_headers,
                              json={"name": f"TEST_{kind}", "target_amount": 100, "kind": kind})
            assert r.status_code == 200, f"kind {kind} failed"


# ----------------- Plans -----------------
class TestPlans:
    EXPECTED_ITEMS = {"wedding": 8, "house": 6, "car": 5, "vacation": 6}

    def test_default_checklist_counts(self, auth_headers):
        for kind, count in self.EXPECTED_ITEMS.items():
            r = requests.post(f"{BASE_URL}/api/plans", headers=auth_headers,
                              json={"kind": kind, "name": f"My {kind}", "total_budget": 10000})
            assert r.status_code == 200, r.text
            p = r.json()["plan"]
            assert len(p["items"]) == count, f"{kind} expected {count} items got {len(p['items'])}"

    def test_patch_items(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/plans", headers=auth_headers,
                          json={"kind": "car", "name": "Car plan", "total_budget": 20000})
        p = r.json()["plan"]
        items = p["items"]
        items[0]["done"] = True
        items[0]["paid"] = 1500.0
        rp = requests.patch(f"{BASE_URL}/api/plans/{p['id']}", headers=auth_headers, json={"items": items})
        assert rp.status_code == 200
        updated = rp.json()["plan"]
        assert updated["items"][0]["done"] is True
        assert updated["items"][0]["paid"] == 1500.0


# ----------------- Debts / Investments / Assets -----------------
class TestPortfolio:
    def test_debt_crud(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/debts", headers=auth_headers,
                          json={"name": "Car Loan", "principal": 10000, "remaining": 8000,
                                "interest_rate": 5.5, "monthly_payment": 200, "kind": "loan"})
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/debts", headers=auth_headers)
        assert g.status_code == 200 and any(d["name"] == "Car Loan" for d in g.json()["debts"])

    def test_investment_crud(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/investments", headers=auth_headers,
                          json={"name": "AAPL", "ticker": "AAPL", "kind": "stock",
                                "quantity": 5, "avg_cost": 100, "current_price": 200})
        assert r.status_code == 200
        inv = r.json()["investment"]
        assert inv["quantity"] * inv["current_price"] == 1000

    def test_asset_crud(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/assets", headers=auth_headers,
                          json={"name": "MacBook", "value": 1800, "kind": "gadget"})
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/assets", headers=auth_headers)
        assert any(a["name"] == "MacBook" for a in g.json()["assets"])


# ----------------- Analytics -----------------
class TestAnalytics:
    def test_summary_shape(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/analytics/summary", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("net_worth", "month_income", "month_expense", "cash_flow",
                  "saving_rate", "debt_ratio", "health_score",
                  "category_breakdown", "trend", "counts"):
            assert k in d, f"missing key {k}"
        assert 0 <= d["health_score"] <= 100
        assert len(d["trend"]) == 6
        assert isinstance(d["category_breakdown"], list)


# ----------------- Coach -----------------
class TestCoach:
    def test_history_empty_initially(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/coach/history?session_id=test-sess-1", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json()["messages"], list)

    def test_coach_chat_stream(self, auth_headers):
        """SSE stream should produce at least one delta and a [DONE]."""
        url = f"{BASE_URL}/api/coach/chat"
        payload = {"session_id": "test-sess-1", "message": "Give me one quick saving tip."}
        got_delta = False
        got_done = False
        with requests.post(url, headers=auth_headers, json=payload, stream=True, timeout=45) as resp:
            assert resp.status_code == 200
            assert "text/event-stream" in resp.headers.get("content-type", "")
            for raw in resp.iter_lines(decode_unicode=True):
                if not raw:
                    continue
                if raw.startswith("data: "):
                    body = raw[6:]
                    if body == "[DONE]":
                        got_done = True
                        break
                    try:
                        obj = json.loads(body)
                        if "delta" in obj and obj["delta"]:
                            got_delta = True
                        elif "error" in obj:
                            pytest.fail(f"stream error: {obj['error']}")
                    except json.JSONDecodeError:
                        pass
        assert got_delta, "no delta chunks received"
        assert got_done, "no [DONE] marker received"

    def test_history_after_chat(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/coach/history?session_id=test-sess-1", headers=auth_headers)
        assert r.status_code == 200
        msgs = r.json()["messages"]
        assert len(msgs) >= 2  # user + assistant
        roles = {m["role"] for m in msgs}
        assert "user" in roles and "assistant" in roles


# ----------------- Security -----------------
class TestSecurity:
    # Send valid bodies so Pydantic passes and auth is actually evaluated
    ENDPOINTS = [
        ("GET", "/api/wallets", None),
        ("POST", "/api/wallets", {"name": "x", "type": "cash", "balance": 0}),
        ("GET", "/api/transactions", None),
        ("POST", "/api/transactions",
         {"wallet_id": "x", "type": "income", "amount": 1, "category": "x"}),
        ("GET", "/api/budgets", None),
        ("POST", "/api/budgets", {"category": "x", "amount": 1}),
        ("GET", "/api/goals", None),
        ("POST", "/api/goals", {"name": "x", "target_amount": 1}),
        ("GET", "/api/plans", None),
        ("POST", "/api/plans", {"kind": "car", "name": "x", "total_budget": 1}),
        ("GET", "/api/debts", None),
        ("GET", "/api/investments", None),
        ("GET", "/api/assets", None),
        ("GET", "/api/analytics/summary", None),
        ("GET", "/api/coach/history?session_id=x", None),
        ("POST", "/api/coach/chat", {"session_id": "x", "message": "hi"}),
        ("GET", "/api/auth/me", None),
        ("PATCH", "/api/auth/me", {}),
    ]

    def test_endpoints_require_auth(self):
        for method, path, body in self.ENDPOINTS:
            kwargs = {"json": body} if body is not None else {}
            r = requests.request(method, f"{BASE_URL}{path}", **kwargs)
            assert r.status_code == 401, f"{method} {path} returned {r.status_code}, expected 401"
