"""Release version consistency.

The backend used to hardcode its version in two places in main.py, which is how
production ended up reporting `1.0.5c` while the app reported `1.0.6c` — you
could not tell which build was actually live.

These tests pin the invariant: the backend has ONE version constant, it is
served by the health endpoint, and it matches the frontend's app.json.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, "D:/Wallume/backend")

from app import version as version_module


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_backend_exposes_a_single_version_constant():
    assert isinstance(version_module.__version__, str)
    assert version_module.__version__.strip()


def test_health_endpoint_reports_the_constant(monkeypatch):
    """The endpoint must read the constant, not a second literal."""
    from app.main import create_app

    app = create_app()
    route = next(r for r in app.routes if getattr(r, "path", None) == "/api/")
    import asyncio

    payload = asyncio.run(route.endpoint())
    assert payload["data"]["version"] == version_module.__version__


def test_build_info_carries_identity_not_just_a_version():
    """Commit and environment are what make a deploy verifiable."""
    info = version_module.build_info()
    assert set(info) == {"version", "commit", "branch", "environment"}
    assert info["version"] == version_module.__version__
    assert info["commit"]  # "unknown" at worst, never empty


def test_commit_comes_from_the_platform_env(monkeypatch):
    monkeypatch.setenv("RAILWAY_GIT_COMMIT_SHA", "abcdef1234567890")
    assert version_module._commit() == "abcdef1"


def test_commit_falls_back_rather_than_lying(monkeypatch):
    for key in ("RAILWAY_GIT_COMMIT_SHA", "GIT_COMMIT", "COMMIT_SHA"):
        monkeypatch.delenv(key, raising=False)
    assert version_module._commit() == "unknown"


def test_backend_and_frontend_versions_match():
    """Both halves ship together, so a mismatch means one is stale."""
    app_json = json.loads((REPO_ROOT / "frontend" / "app.json").read_text(encoding="utf-8"))
    frontend_version = app_json["expo"]["version"]
    assert frontend_version == version_module.__version__, (
        f"frontend/app.json is {frontend_version} but backend/app/version.py is "
        f"{version_module.__version__} — bump both together"
    )


def test_frontend_package_json_matches_app_json():
    """Expo reads app.json, npm reads package.json; they must agree."""
    app_json = json.loads((REPO_ROOT / "frontend" / "app.json").read_text(encoding="utf-8"))
    pkg = json.loads((REPO_ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))
    assert pkg["version"] == app_json["expo"]["version"]


def test_main_py_has_no_hardcoded_version_literal():
    """Regression guard: the original bug was two literals in one file."""
    source = (REPO_ROOT / "backend" / "app" / "main.py").read_text(encoding="utf-8")
    assert "import __version__" in source or "__version__" in source
    # A version-shaped literal inside main.py means it drifted again.
    import re
    assert not re.search(r'"\d+\.\d+\.\d+[a-z]?"', source), "main.py hardcodes a version literal"
