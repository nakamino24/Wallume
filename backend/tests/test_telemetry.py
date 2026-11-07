"""Telemetry must be optional and must not leak financial or auth data."""
import sys

sys.path.insert(0, "D:/Wallume/backend")

from app.core import telemetry


def test_no_dsn_disables_telemetry():
    assert telemetry.init_sentry("", "development") is False


def test_capture_is_a_noop_without_a_dsn():
    # Must never raise, even with telemetry disabled.
    telemetry.capture_exception(RuntimeError("boom"), area="test")


def test_headers_are_scrubbed():
    scrubbed = telemetry._scrub_headers({
        "Authorization": "Bearer secret-token",
        "Cookie": "session=abc",
        "Content-Type": "application/json",
    })
    assert scrubbed["Authorization"] == "[redacted]"
    assert scrubbed["Cookie"] == "[redacted]"
    # Non-sensitive headers survive so reports stay useful.
    assert scrubbed["Content-Type"] == "application/json"


def test_sensitive_body_keys_are_scrubbed():
    scrubbed = telemetry._scrub_mapping({
        "name": "Alex",
        "password": "hunter2",
        "new_password": "hunter3",
        "reset_token": "abc",
        "code": "123456",
    })
    assert scrubbed["name"] == "Alex"
    for key in ("password", "new_password", "reset_token", "code"):
        assert scrubbed[key] == "[redacted]"


def test_scrubbing_is_case_insensitive():
    scrubbed = telemetry._scrub_headers({"AUTHORIZATION": "Bearer x"})
    assert scrubbed["AUTHORIZATION"] == "[redacted]"


def test_scrub_handles_none_safely():
    assert telemetry._scrub_headers(None) == {}
    assert telemetry._scrub_mapping(None) == {}
