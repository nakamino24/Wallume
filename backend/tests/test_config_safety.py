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
