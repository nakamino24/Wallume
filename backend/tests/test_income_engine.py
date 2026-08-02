"""Unit tests for the Income Engine — template loading, calculation methods,
and profession-agnostic behavior. These run without a live server."""

import asyncio
from datetime import date

import pytest

from app.services.income_service import IncomeService
from app.services.income_engine import calculate_amount, forecast_sources, next_payment_date


@pytest.fixture(scope="module")
def templates():
    return asyncio.run(_load())


async def _load():
    svc = IncomeService()
    return await svc.list_templates()


class TestTemplateLoading:
    def test_all_25_templates_present(self, templates):
        ids = {t["id"] for t in templates}
        expected = {
            "office_employee", "government_asn", "bumn_employee", "bank_employee",
            "factory_worker", "healthcare_worker", "doctor", "nurse", "pharmacist",
            "retail_spg", "store_crew", "sales_executive", "customer_service",
            "teacher", "lecturer", "freelancer", "consultant", "software_engineer",
            "driver_courier", "business_owner", "content_creator", "investor",
            "student", "unemployed", "other",
        }
        assert expected.issubset(ids)

    def test_every_template_has_metadata(self, templates):
        for t in templates:
            assert "confidence" in t and 0 <= t["confidence"] <= 100, t["id"]
            assert t.get("country") == "ID", t["id"]
            assert t.get("category"), t["id"]
            assert t.get("icon"), t["id"]

    def test_every_source_has_required_fields(self, templates):
        for t in templates:
            for s in t.get("incomeSources", []):
                for field in ("name", "calculationMethod", "frequency",
                              "expectedPaymentDate", "currency", "taxStatus", "recurring"):
                    assert field in s, f"{t['id']}/{s.get('name')} missing {field}"

    def test_other_template_is_empty(self, templates):
        other = next(t for t in templates if t["id"] == "other")
        assert other["incomeSources"] == []
        assert other["confidence"] < 50


class TestCalculationMethods:
    def test_fixed_amount(self):
        src = {"calculation_method": "fixed_amount", "amount": 5000000}
        assert calculate_amount(src) == 5000000

    def test_per_visit(self):
        src = {"calculation_method": "per_visit", "per_visit": 50000,
               "forecast_rules": {"visitsPerMonth": 150}}
        assert calculate_amount(src) == 7500000

    def test_percentage_of_gross(self):
        src = {"calculation_method": "percentage", "percentage": 10, "percentage_of": "gross"}
        assert calculate_amount(src, gross=5000000) == 500000

    def test_hourly(self):
        src = {"calculation_method": "hourly", "hourly_rate": 35000,
               "forecast_rules": {"avgHoursPerMonth": 20}}
        assert calculate_amount(src) == 700000


class TestNextPaymentDate:
    def test_fixed_date_adjusts_for_holiday(self):
        # Aug 25 2026 is Maulid Nabi (holiday). The adjustment rule shifts it to
        # the previous business day (Mon Aug 24) via forecast_sources.
        sources = [{
            "id": "1", "name": "Base", "calculation_method": "fixed_amount", "amount": 1,
            "expected_payment_date": {"type": "fixed_date", "day": 25},
            "adjustment_rules": [{"type": "weekend_rule", "value": "previous_business_day"}],
            "recurring": True, "tax_status": "taxable",
        }]
        res = forecast_sources(sources, 5, date(2026, 8, 2))
        assert res[0]["next_payment_date"] == "2026-08-24"

    def test_weekend_adjustment(self):
        # Payday day 25 in Feb 2027: Feb 25 2027 is a Thursday -> no adjust.
        d = next_payment_date({"type": "fixed_date", "day": 25}, 5, date(2027, 2, 1))
        assert d.weekday() in (0, 1, 2, 3, 4)

    def test_seven_day_week_ignores_weekend(self):
        d = next_payment_date({"type": "fixed_date", "day": 21}, 7, date(2026, 8, 2))
        # Aug 21 2026 is a Friday, no adjustment needed either way
        assert d == date(2026, 8, 21)

    def test_weekend_rule_applies_to_user_edited_date(self):
        # User overrides salary date to day 30. Aug 30 2026 is a Sunday; the
        # weekend rule must still shift it to the previous business day (Fri 28).
        from app.services.income_engine import apply_weekend_rule
        adjusted = apply_weekend_rule(
            date(2026, 8, 30),
            {"type": "weekend_rule", "value": "previous_business_day"}, 5,
        )
        assert adjusted == date(2026, 8, 28)


class TestEngineIsProfessionAgnostic:
    def test_forecast_does_not_know_profession_names(self):
        # Sources are plain config; engine never references "Nurse"/"Doctor".
        sources = [
            {"id": "1", "name": "Base", "calculation_method": "fixed_amount", "amount": 1000,
             "expected_payment_date": {"type": "fixed_date", "day": 25}, "adjustment_rules": [], "recurring": True, "tax_status": "taxable"},
            {"id": "2", "name": "Fees", "calculation_method": "per_visit", "per_visit": 200,
             "forecast_rules": {"visitsPerMonth": 10},
             "expected_payment_date": {"type": "fixed_date", "day": 25}, "adjustment_rules": [], "recurring": True, "tax_status": "taxable"},
        ]
        res = forecast_sources(sources, 5, date(2026, 8, 2))
        amounts = {r["name"]: r["amount"] for r in res}
        assert amounts["Base"] == 1000
        assert amounts["Fees"] == 2000


class TestTemplateEditFlow:
    def test_editing_source_after_template_changes_forecast(self):
        # Same engine, one source edited from fixed to per-visit.
        base = {"name": "Consult", "calculation_method": "fixed_amount", "amount": 100000,
                "expected_payment_date": {"type": "fixed_date", "day": 25}, "adjustment_rules": [], "recurring": True, "tax_status": "taxable"}
        edited = {**base, "calculation_method": "per_visit", "per_visit": 50000,
                  "forecast_rules": {"visitsPerMonth": 10}}
        assert calculate_amount(base) == 100000
        assert calculate_amount(edited) == 500000


# ---- Integration (requires the backend running on localhost:8001) ----
import requests

BASE_URL = "http://localhost:8001"


class TestIncomeIntegration:
    def test_apply_template_edit_source_forecast(self, auth_headers):
        # List templates
        r = requests.get(f"{BASE_URL}/api/income/templates", headers=auth_headers)
        assert r.status_code == 200
        templates = r.json()["data"]["templates"]
        office = next(t for t in templates if t["id"] == "office_employee")
        assert len(office["incomeSources"]) >= 5

        # Apply the template
        r = requests.post(
            f"{BASE_URL}/api/income/templates/apply?template_id=office_employee",
            headers=auth_headers,
            json={"work_week": 5, "payday_day": 25},
        )
        assert r.status_code == 200, r.text
        assert r.json()["data"]["source_count"] == len(office["incomeSources"])

        # Edit the first source (Base Salary) amount
        sources = requests.get(f"{BASE_URL}/api/income/sources", headers=auth_headers).json()["data"]["sources"]
        base = next(s for s in sources if s["name"] == "Base Salary")
        r = requests.patch(
            f"{BASE_URL}/api/income/sources/{base['id']}", headers=auth_headers,
            json={"amount": 8000000},
        )
        assert r.status_code == 200
        assert r.json()["data"]["source"]["amount"] == 8000000

        # Forecast reflects the edited amount
        r = requests.get(f"{BASE_URL}/api/income/forecast", headers=auth_headers)
        assert r.status_code == 200
        f = r.json()["data"]
        assert f["count"] == len(sources)
        base_forecast = next(x for x in f["sources"] if x["name"] == "Base Salary")
        assert base_forecast["amount"] == 8000000
        assert base_forecast["next_payment_date"] is not None
