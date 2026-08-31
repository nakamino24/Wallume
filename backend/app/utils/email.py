"""Single source for email normalization.

CURRENT: signup/login used email.lower() (no strip).
TARGET: email.strip().lower() via normalize_email.

Reads must tolerate legacy case differences; writes must be canonical.
"""

def normalize_email(email: str) -> str:
    if not isinstance(email, str):
        return ""
    return email.strip().lower()


def normalize_email_for_lookup(email: str) -> str:
    """Same as normalize_email — explicit alias for read paths."""
    return normalize_email(email)
