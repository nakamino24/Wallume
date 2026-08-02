"""One-time generator for Wallume income templates (3-18).
The resulting JSON files in this directory are the source of truth; the engine
reads them at runtime. A new profession = a new JSON file, no engine changes."""

import json
from pathlib import Path

HERE = Path(__file__).parent

PD25 = {"type": "fixed_date", "day": 25}
PD25R = {"type": "fixed_date", "day": 25}
WEEKEND_PREV = [{"type": "weekend_rule", "value": "previous_business_day"}]
WEEKEND_COMPANY = [{"type": "weekend_rule", "value": "previous_business_day"}]  # resolved against company calendar

T = {}

T["factory_worker"] = {
  "id": "factory_worker", "name": "Factory Worker",
  "description": "Shift worker on a Mon-Sat schedule.",
  "workWeekDefault": 6, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Base Salary", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_COMPANY, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 3200000 },
    { "name": "Shift Allowance", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_COMPANY, "forecastRules": {}, "currency": "IDR", "taxStatus": "nontaxable", "recurring": True, "amount": 400000 },
    { "name": "Overtime", "calculationMethod": "hourly", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_COMPANY, "forecastRules": { "avgHoursPerMonth": 25 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "hourlyRate": 25000 },
    { "name": "Attendance Bonus", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_COMPANY, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 250000 },
    { "name": "Performance Bonus", "calculationMethod": "percentage", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_COMPANY, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": False, "percentage": 15, "percentageOf": "base_salary" }
  ]
}

T["nurse"] = {
  "id": "nurse", "name": "Nurse",
  "description": "Hospital nurse with shift pay.",
  "workWeekDefault": 5, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Base Salary", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 4200000 },
    { "name": "Shift Allowance", "calculationMethod": "per_shift", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": { "shiftsPerMonth": 20 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perShift": 60000 },
    { "name": "Night Shift", "calculationMethod": "per_shift", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": { "shiftsPerMonth": 6 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perShift": 90000 },
    { "name": "Overtime", "calculationMethod": "hourly", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": { "avgHoursPerMonth": 15 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "hourlyRate": 30000 },
    { "name": "Holiday Shift", "calculationMethod": "per_shift", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": { "shiftsPerMonth": 2 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perShift": 150000 },
    { "name": "Incentive", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 300000 }
  ]
}

T["doctor"] = {
  "id": "doctor", "name": "Doctor",
  "description": "Mixed fixed retainer plus per-visit fees.",
  "workWeekDefault": 5, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Monthly Retainer", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 10000000 },
    { "name": "Consultation Fee", "calculationMethod": "per_visit", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": { "visitsPerMonth": 150 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perVisit": 50000 },
    { "name": "Surgery Fee", "calculationMethod": "per_project", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": { "projectsPerMonth": 8 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perProject": 750000 },
    { "name": "On Call Fee", "calculationMethod": "per_shift", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": { "shiftsPerMonth": 4 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perShift": 350000 },
    { "name": "Incentive", "calculationMethod": "percentage", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "percentage": 20, "percentageOf": "gross" }
  ]
}

T["pharmacist"] = {
  "id": "pharmacist", "name": "Pharmacist",
  "description": "Pharmacy professional with shift-based pay.",
  "workWeekDefault": 5, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Monthly Salary", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 5000000 },
    { "name": "Shift Allowance", "calculationMethod": "per_shift", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": { "shiftsPerMonth": 18 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perShift": 50000 },
    { "name": "Incentive", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 350000 }
  ]
}

T["retail_spg"] = {
  "id": "retail_spg", "name": "Retail / SPG",
  "description": "Sales promotion girl with commission.",
  "workWeekDefault": 6, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Base Salary", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_COMPANY, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 2800000 },
    { "name": "Sales Commission", "calculationMethod": "per_sale", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_COMPANY, "forecastRules": { "salesPerMonth": 30 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perSale": 50000 },
    { "name": "Attendance Bonus", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_COMPANY, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 200000 },
    { "name": "Sales Target Bonus", "calculationMethod": "percentage", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_COMPANY, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": False, "percentage": 10, "percentageOf": "gross" }
  ]
}

T["sales_executive"] = {
  "id": "sales_executive", "name": "Sales Executive",
  "description": "B2B sales professional with layered commissions.",
  "workWeekDefault": 5, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Base Salary", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 5000000 },
    { "name": "Commission", "calculationMethod": "percentage", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "percentage": 5, "percentageOf": "gross" },
    { "name": "Monthly Incentive", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 1000000 },
    { "name": "Quarterly Bonus", "calculationMethod": "fixed_amount", "frequency": "quarterly", "expectedPaymentDate": { "type": "last_calendar_day" }, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": False, "amount": 3000000 },
    { "name": "Annual Bonus", "calculationMethod": "percentage", "frequency": "annually", "expectedPaymentDate": { "type": "fixed_date", "day": 15, "month": 12 }, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": False, "percentage": 100, "percentageOf": "base_salary" }
  ]
}

T["freelancer"] = {
  "id": "freelancer", "name": "Freelancer",
  "description": "Flexible project and hourly work.",
  "workWeekDefault": 5, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Per Project", "calculationMethod": "per_project", "frequency": "custom", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "projectsPerMonth": 2 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perProject": 4000000 },
    { "name": "Hourly Rate", "calculationMethod": "hourly", "frequency": "custom", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "avgHoursPerMonth": 30 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "hourlyRate": 150000 },
    { "name": "Retainer", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": { "type": "fixed_date", "day": 1 }, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 5000000 },
    { "name": "Bonus", "calculationMethod": "fixed_amount", "frequency": "custom", "expectedPaymentDate": { "type": "manual" }, "adjustmentRules": [], "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": False, "amount": 0 }
  ]
}

T["consultant"] = {
  "id": "consultant", "name": "Consultant",
  "description": "Daily and hourly consulting income.",
  "workWeekDefault": 5, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Daily Rate", "calculationMethod": "daily", "frequency": "custom", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "daysPerMonth": 12 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "dailyRate": 1500000 },
    { "name": "Hourly Rate", "calculationMethod": "hourly", "frequency": "custom", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "avgHoursPerMonth": 20 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "hourlyRate": 250000 },
    { "name": "Retainer", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": { "type": "fixed_date", "day": 1 }, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 8000000 }
  ]
}

T["driver"] = {
  "id": "driver", "name": "Driver",
  "description": "Driver with trip incentives and tips.",
  "workWeekDefault": 6, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Base Salary", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_COMPANY, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 2500000 },
    { "name": "Trip Incentive", "calculationMethod": "per_sale", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_COMPANY, "forecastRules": { "salesPerMonth": 40 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perSale": 15000 },
    { "name": "Tips", "calculationMethod": "manual", "frequency": "custom", "expectedPaymentDate": { "type": "manual" }, "adjustmentRules": [], "forecastRules": { "avgPerMonth": 500000 }, "currency": "IDR", "taxStatus": "nontaxable", "recurring": True, "amount": 500000 },
    { "name": "Bonus", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_COMPANY, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": False, "amount": 200000 }
  ]
}

T["teacher_lecturer"] = {
  "id": "teacher_lecturer", "name": "Teacher / Lecturer",
  "description": "Academic with salary plus teaching hours.",
  "workWeekDefault": 5, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Monthly Salary", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 5500000 },
    { "name": "Teaching Hours", "calculationMethod": "hourly", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": { "avgHoursPerMonth": 24 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "hourlyRate": 75000 },
    { "name": "Honorarium", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 1000000 },
    { "name": "Certification Allowance", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": PD25, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "nontaxable", "recurring": True, "amount": 250000 }
  ]
}

T["business_owner"] = {
  "id": "business_owner", "name": "Business Owner",
  "description": "Business income from operations and distributions.",
  "workWeekDefault": 5, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Revenue", "calculationMethod": "manual", "frequency": "monthly", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "avgPerMonth": 15000000 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 15000000 },
    { "name": "Profit Distribution", "calculationMethod": "percentage", "frequency": "quarterly", "expectedPaymentDate": { "type": "last_calendar_day" }, "adjustmentRules": [], "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "percentage": 30, "percentageOf": "gross" },
    { "name": "Dividend", "calculationMethod": "manual", "frequency": "annually", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "avgPerYear": 20000000 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 20000000 },
    { "name": "Owner Draw", "calculationMethod": "manual", "frequency": "custom", "expectedPaymentDate": { "type": "manual" }, "adjustmentRules": [], "forecastRules": {}, "currency": "IDR", "taxStatus": "nontaxable", "recurring": False, "amount": 0 }
  ]
}

T["content_creator"] = {
  "id": "content_creator", "name": "Content Creator",
  "description": "Creator income from multiple platforms.",
  "workWeekDefault": 7, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Adsense", "calculationMethod": "manual", "frequency": "monthly", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "avgPerMonth": 3000000 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 3000000 },
    { "name": "Sponsorship", "calculationMethod": "per_project", "frequency": "monthly", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "projectsPerMonth": 2 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perProject": 5000000 },
    { "name": "Affiliate", "calculationMethod": "per_sale", "frequency": "monthly", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "salesPerMonth": 20 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perSale": 25000 },
    { "name": "Donation", "calculationMethod": "manual", "frequency": "custom", "expectedPaymentDate": { "type": "manual" }, "adjustmentRules": [], "forecastRules": { "avgPerMonth": 1000000 }, "currency": "IDR", "taxStatus": "nontaxable", "recurring": True, "amount": 1000000 },
    { "name": "Brand Deals", "calculationMethod": "per_project", "frequency": "monthly", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "projectsPerMonth": 1 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "perProject": 8000000 }
  ]
}

T["investor"] = {
  "id": "investor", "name": "Investor",
  "description": "Passive investment income.",
  "workWeekDefault": 7, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Dividend", "calculationMethod": "manual", "frequency": "quarterly", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "avgPerQuarter": 3000000 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 3000000 },
    { "name": "Bond Coupon", "calculationMethod": "percentage", "frequency": "annually", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "percentage": 6, "percentageOf": "gross" },
    { "name": "Interest", "calculationMethod": "manual", "frequency": "monthly", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "avgPerMonth": 500000 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 500000 },
    { "name": "Rental Income", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": { "type": "fixed_date", "day": 1 }, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "amount": 4000000 },
    { "name": "Capital Gain", "calculationMethod": "manual", "frequency": "custom", "expectedPaymentDate": { "type": "manual" }, "adjustmentRules": [], "forecastRules": {}, "currency": "IDR", "taxStatus": "taxable", "recurring": False, "amount": 0 }
  ]
}

T["student"] = {
  "id": "student", "name": "Student",
  "description": "Student income from allowance and part-time work.",
  "workWeekDefault": 5, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Allowance", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": { "type": "fixed_date", "day": 1 }, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "nontaxable", "recurring": True, "amount": 1500000 },
    { "name": "Scholarship", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": { "type": "fixed_date", "day": 10 }, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "nontaxable", "recurring": True, "amount": 2500000 },
    { "name": "Part-time Job", "calculationMethod": "hourly", "frequency": "monthly", "expectedPaymentDate": { "type": "company_policy" }, "adjustmentRules": [], "forecastRules": { "avgHoursPerMonth": 40 }, "currency": "IDR", "taxStatus": "taxable", "recurring": True, "hourlyRate": 25000 }
  ]
}

T["unemployed"] = {
  "id": "unemployed", "name": "Unemployed",
  "description": "Support and withdrawals while between jobs.",
  "workWeekDefault": 7, "paydayDayDefault": 25,
  "incomeSources": [
    { "name": "Savings Withdrawal", "calculationMethod": "manual", "frequency": "custom", "expectedPaymentDate": { "type": "manual" }, "adjustmentRules": [], "forecastRules": {}, "currency": "IDR", "taxStatus": "nontaxable", "recurring": False, "amount": 0 },
    { "name": "Family Support", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": { "type": "fixed_date", "day": 1 }, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "nontaxable", "recurring": True, "amount": 1000000 },
    { "name": "Government Assistance", "calculationMethod": "fixed_amount", "frequency": "monthly", "expectedPaymentDate": { "type": "fixed_date", "day": 5 }, "adjustmentRules": WEEKEND_PREV, "forecastRules": {}, "currency": "IDR", "taxStatus": "nontaxable", "recurring": True, "amount": 500000 }
  ]
}

T["custom"] = {
  "id": "custom", "name": "Custom",
  "description": "Build your own income sources from scratch.",
  "workWeekDefault": 5, "paydayDayDefault": 25,
  "incomeSources": []
}

for tid, data in T.items():
    (HERE / f"{tid}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

print(f"Generated {len(T)} templates: {', '.join(T.keys())}")
