import os
import time
import pytest
import requests

BASE_URL = "http://localhost:8001"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_user(api_client):
    """Signup a fresh user and return {token, user}."""
    epoch = int(time.time() * 1000)
    email = f"alex+{epoch}@matrix.dev"
    payload = {"name": "Alex", "email": email, "password": "password123"}
    r = api_client.post(f"{BASE_URL}/api/auth/signup", json=payload)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return {"token": data["token"], "user": data["user"], "email": email, "password": "password123"}


@pytest.fixture(scope="session")
def auth_headers(auth_user):
    return {"Authorization": f"Bearer {auth_user['token']}", "Content-Type": "application/json"}
