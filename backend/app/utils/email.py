"""Single source for email normalization.

CURRENT: signup/login used email.lower() (no strip).
TARGET: email.strip().lower() via normalize_email.

Inputs are normalized before exact indexed lookup; writes are canonical.
"""

def normalize_email(email: str) -> str:
    if not isinstance(email, str):
        return ""
    return email.strip().lower()
