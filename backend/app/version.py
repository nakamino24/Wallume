"""Release version and build identity.

One source of truth for the backend version. It was previously hardcoded in
two places in `main.py`, which is why the health endpoint reported `1.0.5c`
while the app reported `1.0.6c` — and why you could not tell which build was
actually deployed.

`build_info()` adds the commit and environment so a deployed instance can
identify itself exactly. That is the thing to check when a deploy looks like
it "didn't land".
"""
from __future__ import annotations

import os
from typing import Any

# Keep in lockstep with frontend/app.json. CI fails if they diverge
# (.github/workflows/ci.yml -> "version sync").
__version__ = "1.0.7a"


def _commit() -> str:
    """Short commit SHA of the running build.

    Railway injects RAILWAY_GIT_COMMIT_SHA; GIT_COMMIT covers other hosts and
    local overrides. Falls back to "unknown" rather than guessing.
    """
    for key in ("RAILWAY_GIT_COMMIT_SHA", "GIT_COMMIT", "COMMIT_SHA"):
        value = (os.environ.get(key) or "").strip()
        if value:
            return value[:7]
    return "unknown"


def _branch() -> str:
    for key in ("RAILWAY_GIT_BRANCH", "GIT_BRANCH"):
        value = (os.environ.get(key) or "").strip()
        if value:
            return value
    return "unknown"


def build_info() -> dict[str, Any]:
    """Identity of this build, for health checks and deploy verification."""
    environment = (
        os.environ.get("RAILWAY_ENVIRONMENT_NAME")
        or os.environ.get("ENVIRONMENT")
        or "development"
    )
    return {
        "version": __version__,
        "commit": _commit(),
        "branch": _branch(),
        "environment": environment,
    }
