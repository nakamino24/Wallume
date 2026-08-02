"""Generator for Wallume Occupation Presets (v2).

Produces the JSON config files (source of truth) for all 25 occupations.
Pure configuration — NO business logic. The Income Engine stays untouched.

Adding a new occupation = add a new dict here (or a new JSON file) and re-run.
Country-specific sets are supported via the "country" field.
"""

import json
from pathlib import Path

HERE = Path(__file__).parent

# ---- rule presets ---------------------------------------------------------
def fd(day):  # fixed_date rule
    return {"type": "fixed_date", "day": day}

def prev_bd():  # weekend/holiday -> previous business day
    return [{"type": "weekend_rule", "value": "previous_business_day"}]

def no_adj():
    return [{"type": "weekend_rule", "value": "no_adjustment"}]

# ---- helper to build a source ---------------------------------------------
def src(name, method, freq="monthly", date=None, adj=None, tax="taxable", rec=True):
    return {
        "name": name,
        "calculationMethod": method,
        "frequency": freq,
        "expectedPaymentDate": date or fd(25),
        "adjustmentRules": adj or prev_bd(),
        "forecastRules": {},
        "currency": "IDR",
        "taxStatus": tax,
        "recurring": rec,
    }

# ---- templates ------------------------------------------------------------
T = {
    "office_employee": {
        "name": "Office Employee", "category": "Office / Professional", "icon": "briefcase",
        "confidence": 90, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Monthly Salary", "fixed_amount"),
            src("Meal Allowance", "fixed_amount", tax="nontaxable"),
            src("Transport Allowance", "fixed_amount", tax="nontaxable"),
        ],
    },
    "government_asn": {
        "name": "Government Employee (ASN)", "category": "Government", "icon": "business",
        "confidence": 90, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Base Salary", "fixed_amount"),
            src("Position Allowance", "fixed_amount"),
            src("Performance Allowance", "fixed_amount"),
            src("Meal Allowance", "fixed_amount", tax="nontaxable"),
        ],
    },
    "bumn_employee": {
        "name": "BUMN Employee", "category": "Government", "icon": "business",
        "confidence": 85, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Monthly Salary", "fixed_amount"),
            src("Position Allowance", "fixed_amount"),
            src("Meal Allowance", "fixed_amount", tax="nontaxable"),
            src("Transport Allowance", "fixed_amount", tax="nontaxable"),
        ],
    },
    "bank_employee": {
        "name": "Bank Employee", "category": "Office / Professional", "icon": "cash",
        "confidence": 95, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [src("Monthly Salary", "fixed_amount")],
    },
    "factory_worker": {
        "name": "Factory Worker", "category": "Blue Collar / Shift", "icon": "construct",
        "confidence": 95, "workWeekDefault": 6, "paydayDayDefault": 25,
        "sources": [
            src("Base Salary", "fixed_amount"),
            src("Shift Allowance", "fixed_amount", tax="nontaxable"),
            src("Attendance Bonus", "fixed_amount"),
        ],
    },
    "healthcare_worker": {
        "name": "Healthcare Worker", "category": "Healthcare", "icon": "medkit",
        "confidence": 70, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Monthly Salary", "fixed_amount"),
            src("Shift Allowance", "fixed_amount"),
        ],
    },
    "doctor": {
        "name": "Doctor", "category": "Healthcare", "icon": "medical",
        "confidence": 60, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Monthly Retainer", "fixed_amount"),
            src("Consultation Fee", "per_visit"),
            src("Operation Fee", "per_project"),
            src("On Call", "per_shift"),
        ],
    },
    "nurse": {
        "name": "Nurse", "category": "Healthcare", "icon": "medkit",
        "confidence": 70, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Base Salary", "fixed_amount"),
            src("Shift Allowance", "per_shift"),
            src("Night Shift", "per_shift"),
            src("Holiday Shift", "per_shift"),
        ],
    },
    "pharmacist": {
        "name": "Pharmacist", "category": "Healthcare", "icon": "flask",
        "confidence": 75, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Monthly Salary", "fixed_amount"),
            src("Shift Allowance", "per_shift"),
        ],
    },
    "retail_spg": {
        "name": "Retail / SPG", "category": "Retail", "icon": "cart",
        "confidence": 70, "workWeekDefault": 7, "paydayDayDefault": 25,
        "sources": [
            src("Base Salary", "fixed_amount"),
            src("Sales Commission", "per_sale"),
            src("Attendance Bonus", "fixed_amount"),
        ],
    },
    "store_crew": {
        "name": "Store Crew", "category": "Retail", "icon": "storefront",
        "confidence": 75, "workWeekDefault": 6, "paydayDayDefault": 25,
        "sources": [src("Monthly Salary", "fixed_amount")],
    },
    "sales_executive": {
        "name": "Sales Executive", "category": "Office / Professional", "icon": "trending-up",
        "confidence": 75, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Base Salary", "fixed_amount"),
            src("Commission", "percentage"),
            src("Monthly Incentive", "fixed_amount"),
        ],
    },
    "customer_service": {
        "name": "Customer Service", "category": "Office / Professional", "icon": "headset",
        "confidence": 80, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [src("Monthly Salary", "fixed_amount")],
    },
    "teacher": {
        "name": "Teacher", "category": "Education", "icon": "school",
        "confidence": 80, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Monthly Salary", "fixed_amount"),
            src("Teaching Hours", "hourly"),
        ],
    },
    "lecturer": {
        "name": "Lecturer", "category": "Education", "icon": "school",
        "confidence": 75, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Monthly Salary", "fixed_amount"),
            src("Teaching Hours", "hourly"),
            src("Honorarium", "fixed_amount"),
            src("Certification Allowance", "fixed_amount", tax="nontaxable"),
        ],
    },
    "freelancer": {
        "name": "Freelancer", "category": "Freelance / Gig", "icon": "laptop",
        "confidence": 50, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Per Project", "per_project", "custom", {"type": "company_policy"}),
            src("Hourly Income", "hourly", "custom", {"type": "company_policy"}),
            src("Retainer", "fixed_amount", "monthly", fd(1)),
        ],
    },
    "consultant": {
        "name": "Consultant", "category": "Freelance / Gig", "icon": "analytics",
        "confidence": 55, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Daily Rate", "daily", "custom", {"type": "company_policy"}),
            src("Hourly Rate", "hourly", "custom", {"type": "company_policy"}),
            src("Retainer", "fixed_amount", "monthly", fd(1)),
        ],
    },
    "software_engineer": {
        "name": "Software Engineer", "category": "Freelance / Gig", "icon": "code-slash",
        "confidence": 75, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Monthly Salary", "fixed_amount"),
            src("Performance Bonus", "fixed_amount"),
        ],
    },
    "driver_courier": {
        "name": "Driver / Courier", "category": "Blue Collar / Shift", "icon": "bicycle",
        "confidence": 60, "workWeekDefault": 6, "paydayDayDefault": 25,
        "sources": [
            src("Base Salary", "fixed_amount"),
            src("Trip Incentive", "per_sale"),
            src("Tips", "manual", "custom", {"type": "manual"}, tax="nontaxable"),
        ],
    },
    "business_owner": {
        "name": "Business Owner", "category": "Self-Employed / Owner", "icon": "storefront",
        "confidence": 40, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Business Revenue", "manual", "monthly", {"type": "company_policy"}),
            src("Profit Distribution", "manual", "quarterly", {"type": "last_calendar_day"}),
            src("Owner Draw", "manual", "custom", {"type": "manual"}),
        ],
    },
    "content_creator": {
        "name": "Content Creator", "category": "Freelance / Gig", "icon": "videocam",
        "confidence": 35, "workWeekDefault": 7, "paydayDayDefault": 25,
        "sources": [
            src("Adsense", "manual", "monthly", {"type": "company_policy"}),
            src("Sponsorship", "per_project", "monthly", {"type": "company_policy"}),
            src("Affiliate", "per_sale", "monthly", {"type": "company_policy"}),
            src("Donation", "manual", "custom", {"type": "manual"}, tax="nontaxable"),
        ],
    },
    "investor": {
        "name": "Investor", "category": "Self-Employed / Owner", "icon": "pie-chart",
        "confidence": 30, "workWeekDefault": 7, "paydayDayDefault": 25,
        "sources": [
            src("Dividend", "manual", "quarterly", {"type": "company_policy"}),
            src("Rental Income", "fixed_amount", "monthly", fd(1)),
            src("Interest", "manual", "monthly", {"type": "company_policy"}),
        ],
    },
    "student": {
        "name": "Student", "category": "Student / Other", "icon": "book",
        "confidence": 85, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [
            src("Allowance", "fixed_amount", "monthly", fd(1), tax="nontaxable"),
            src("Scholarship", "fixed_amount", "monthly", fd(10), tax="nontaxable"),
            src("Part-time Job", "hourly"),
        ],
    },
    "unemployed": {
        "name": "Unemployed", "category": "Student / Other", "icon": "hourglass",
        "confidence": 90, "workWeekDefault": 7, "paydayDayDefault": 25,
        "sources": [
            src("Savings Withdrawal", "manual", "custom", {"type": "manual"}, tax="nontaxable"),
            src("Family Support", "fixed_amount", "monthly", fd(1), tax="nontaxable"),
        ],
    },
    "other": {
        "name": "Other", "category": "Student / Other", "icon": "ellipsis-horizontal",
        "confidence": 20, "workWeekDefault": 5, "paydayDayDefault": 25,
        "sources": [],
    },
}

for tid, data in T.items():
    doc = {
        "id": tid,
        "name": data["name"],
        "description": f"{data['name']} preset.",
        "country": "ID",
        "category": data["category"],
        "icon": data["icon"],
        "confidence": data["confidence"],
        "workWeekDefault": data["workWeekDefault"],
        "paydayDayDefault": data["paydayDayDefault"],
        "incomeSources": data["sources"],
    }
    (HERE / f"{tid}.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")

print(f"Generated {len(T)} occupation presets")
