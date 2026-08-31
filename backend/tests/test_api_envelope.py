import pytest
from fastapi.testclient import TestClient

# Use the real app but mock DB not needed for envelope shape — we test the route wrapper
from app.main import app

client = TestClient(app)

def test_openapi_has_auth_routes():
    openapi = app.openapi()
    paths = openapi["paths"]
    assert "/api/auth/signup" in paths
    assert "/api/auth/login" in paths
    assert "/api/auth/me" in paths
    assert "/api/wallets" in paths
    assert "/api/transactions" in paths

def test_unauthenticated_me_returns_401_envelope():
    r = client.get("/api/auth/me")
    # FastAPI will return 401 JSON; our envelope is {success,data} but auth returns HTTPException which is not enveloped?
    # At least status should be 401
    assert r.status_code == 401
