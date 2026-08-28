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
    settings = Settings(environment="production", jwt_secret="a-long-unique-production-secret")
    settings.validate_production_safety()


def test_railway_production_name_is_also_protected():
    settings = Settings(
        environment="development",
        railway_environment_name="production",
        jwt_secret=Settings.DEFAULT_JWT_SECRET,
    )
    with pytest.raises(RuntimeError, match="default JWT_SECRET"):
        settings.validate_production_safety()
