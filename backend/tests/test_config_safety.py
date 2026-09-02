import pytest

from app.core.config import Settings


def test_development_allows_documented_default_jwt_secret():
    settings = Settings(environment="development")
    settings.validate_production_safety()


def test_production_rejects_default_jwt_secret():
    settings = Settings(environment="production", jwt_secret=Settings.DEFAULT_JWT_SECRET)
    with pytest.raises(RuntimeError, match="default JWT_SECRET"):
        settings.validate_production_safety()


def test_production_accepts_configured_jwt_secret():
    settings = Settings(
        environment="production",
        jwt_secret="a-long-unique-production-secret",
        mongo_url="mongodb://cluster.example.com:27017",
        db_name="wallume_prod",
    )
    settings.validate_production_safety()


def test_railway_production_name_is_also_protected():
    settings = Settings(
        environment="development",
        railway_environment_name="production",
        jwt_secret=Settings.DEFAULT_JWT_SECRET,
    )
    with pytest.raises(RuntimeError, match="default JWT_SECRET"):
        settings.validate_production_safety()


def test_development_allows_local_mongo_defaults():
    s = Settings(environment="development", mongo_url="mongodb://localhost:27017", db_name="wallume", jwt_secret=Settings.DEFAULT_JWT_SECRET)
    # dev allows localhost + default secret? No, prod check only for prod env
    s.environment = "development"
    s.validate_production_safety()


def test_production_rejects_localhost_mongo():
    s = Settings(environment="production", jwt_secret="a-long-unique-production-secret", mongo_url="mongodb://localhost:27017", db_name="wallume")
    with pytest.raises(RuntimeError, match="localhost MONGO_URL"):
        s.validate_production_safety()


def test_production_rejects_empty_mongo():
    s = Settings(environment="production", jwt_secret="a-long-unique-production-secret", mongo_url="", db_name="wallume")
    with pytest.raises(RuntimeError, match="empty MONGO_URL"):
        s.validate_production_safety()


def test_production_rejects_empty_db():
    s = Settings(environment="production", jwt_secret="a-long-unique-production-secret", mongo_url="mongodb://cluster.example.com:27017", db_name="")
    with pytest.raises(RuntimeError, match="empty DB_NAME"):
        s.validate_production_safety()


def test_production_rejects_unsafe_db_test():
    s = Settings(environment="production", jwt_secret="a-long-unique-production-secret", mongo_url="mongodb://cluster.example.com:27017", db_name="test")
    with pytest.raises(RuntimeError, match="unsafe DB_NAME"):
        s.validate_production_safety()


def test_production_accepts_proper_config():
    s = Settings(environment="production", jwt_secret="a-long-unique-production-secret", mongo_url="mongodb://cluster.example.com:27017", db_name="wallume_prod")
    s.validate_production_safety()


def production_with_password_reset(**overrides):
    values = {
        "environment": "production",
        "jwt_secret": "a-long-unique-production-secret",
        "mongo_url": "mongodb://cluster.example.com:27017",
        "db_name": "wallume_prod",
        "password_reset_enabled": True,
        "password_reset_secret": "a-dedicated-password-reset-secret-over-32-characters",
        "password_reset_email_provider": "resend",
        "password_reset_from_email": "Wallume <support@wallume.app>",
        "resend_api_key": "re_test_secret",
    }
    values.update(overrides)
    return Settings(**values)


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"password_reset_secret": "short"}, "unsafe PASSWORD_RESET_SECRET"),
        ({"password_reset_email_provider": "disabled"}, "must be 'resend'"),
        ({"password_reset_from_email": ""}, "PASSWORD_RESET_FROM_EMAIL"),
        ({"resend_api_key": ""}, "RESEND_API_KEY"),
        ({
            "jwt_secret": "one-shared-secret-that-is-definitely-longer-than-32-characters",
            "password_reset_secret": "one-shared-secret-that-is-definitely-longer-than-32-characters",
        }, "must not reuse JWT_SECRET"),
        ({"password_reset_otp_minutes": 0}, "PASSWORD_RESET_OTP_MINUTES"),
        ({"password_reset_token_minutes": 0}, "PASSWORD_RESET_TOKEN_MINUTES"),
        ({"password_reset_cooldown_seconds": 0}, "PASSWORD_RESET_COOLDOWN_SECONDS"),
        ({"password_reset_max_attempts": 0}, "PASSWORD_RESET_MAX_ATTEMPTS"),
    ],
)
def test_production_rejects_unsafe_password_reset_configuration(override, message):
    with pytest.raises(RuntimeError, match=message):
        production_with_password_reset(**override).validate_production_safety()


def test_production_accepts_safe_password_reset_configuration():
    production_with_password_reset().validate_production_safety()


@pytest.mark.parametrize(
    "sender",
    [
        "onboarding@resend.dev",
        "Wallume <onboarding@resend.dev>",
        "Wallume <NO-REPLY@RESEND.DEV>",
    ],
)
def test_production_rejects_resend_test_domain_for_password_recovery(sender):
    with pytest.raises(RuntimeError, match="Resend test domain"):
        production_with_password_reset(password_reset_from_email=sender).validate_production_safety()


def test_development_allows_resend_test_domain_for_local_testing():
    settings = production_with_password_reset(
        environment="development",
        railway_environment_name="",
        password_reset_from_email="onboarding@resend.dev",
    )
    settings.validate_production_safety()
