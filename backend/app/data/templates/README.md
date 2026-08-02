# Wallume Income Template Engine

## Overview

Wallume lets users set up their income by choosing an **occupation template** that
pre-fills a list of **Income Sources** plus payroll config. The underlying
**Income Engine** is fully generic — it never knows profession names. Templates
are pure configuration data (JSON files); adding a new profession is a new JSON
file, with **no engine code changes**.

Layer order (do not collapse):

```
Template (JSON config)
  └─> Income Source[]            (user-owned, editable / reorderable)
        └─> Calculation Method   (14 methods)
              └─> Schedule       (8 frequencies)
                    └─> Rules    (Payment Date Rule + Weekend Rule + Company Working Calendar)
                          └─> Income Engine  (profession-agnostic)
```

## Where things live

| Piece | Location |
|---|---|
| 18 templates (config) | `backend/app/data/templates/*.json` |
| Template generator (build tool) | `backend/app/data/templates/generate_remaining.py` |
| Company Working Calendar (holidays) | `backend/app/data/holidays.py` |
| Income Engine | `backend/app/services/income_engine.py` |
| Income service (apply/CRUD/forecast/AI) | `backend/app/services/income_service.py` |
| Income API | `backend/app/api/income.py` |
| Income Setup UI | `frontend/app/income-setup.tsx` |

## Template JSON structure

Each file is one template. Every income source must define: **Name, Calculation
Method, Payment Frequency, Expected Payment Date, Adjustment Rules, Forecast
Rules, Currency, Tax Status, Recurring or One-Time**.

```jsonc
{
  "id": "office_employee",
  "name": "Office Employee",
  "description": "Salaried office worker.",
  "workWeekDefault": 5,          // presets user profile work_week (5/6/7)
  "paydayDayDefault": 25,        // presets user profile payday_day
  "incomeSources": [
    {
      "name": "Base Salary",
      "calculationMethod": "fixed_amount",
      "frequency": "monthly",
      "expectedPaymentDate": { "type": "fixed_date", "day": 25 },
      "adjustmentRules": [{ "type": "weekend_rule", "value": "previous_business_day" }],
      "forecastRules": {},
      "currency": "IDR",
      "taxStatus": "taxable",
      "recurring": true,
      "amount": 5000000
    }
  ]
}
```

### Calculation methods (14)

`fixed_amount`, `hourly`, `daily`, `weekly`, `monthly`, `semi_monthly`,
`biweekly`, `per_shift`, `per_visit`, `per_sale`, `per_project`, `percentage`,
`formula`, `manual`.

- `hourly` → `hourlyRate × forecastRules.avgHoursPerMonth`
- `daily` → `dailyRate × forecastRules.daysPerMonth`
- `per_visit` → `perVisit × forecastRules.visitsPerMonth`
- `per_shift` → `perShift × forecastRules.shiftsPerMonth`
- `per_sale` → `perSale × forecastRules.salesPerMonth`
- `per_project` → `perProject × forecastRules.projectsPerMonth`
- `percentage` → `percentage% × (gross | base_salary)` via `percentageOf`
- `manual` / `formula` → user-entered amount

### Payment Date Rules

`fixed_date` (day/month), `last_calendar_day`, `last_business_day`,
`first_business_day`, `nth_weekday` (weekday + nth), `manual`, `company_policy`.

### Frequencies

`daily`, `weekly`, `biweekly`, `semi_monthly`, `monthly`, `quarterly`, `annually`, `custom`.

## How to add a new profession template

1. Create `backend/app/data/templates/<your_id>.json` with the structure above.
2. That's it — the engine reads the directory at request time. **No code changes.**
   (Optional: regenerate via `generate_remaining.py` if you prefer the script as source.)
3. To verify: `GET /api/income/templates` should list it, and
   `POST /api/income/templates/apply?template_id=<your_id>` should apply it.

### Runtime admin CRUD (DB overrides)

Templates can also be managed at runtime (DB overrides win over JSON by `id`).
Gated to admin emails set via the `ADMIN_EMAILS` env var (comma-separated):

```
POST   /api/admin/income-templates           create
PATCH  /api/admin/income-templates/{id}      update
DELETE /api/admin/income-templates/{id}      delete
```

The engine's profession-agnostic guarantee is tested in
`tests/test_income_engine.py::TestEngineIsProfessionAgnostic`.

## API

- `GET /api/income/templates` — list all templates
- `GET /api/income/templates/{id}` — one template
- `POST /api/income/templates/apply?template_id={id}` — apply (creates income sources + presets)
- `POST /api/income/templates/suggest` — AI suggestion from job description (Groq)
- `GET/POST/PATCH/DELETE /api/income/sources[/{id}]` — user income-source CRUD
- `POST /api/income/sources/reorder` — reorder sources
- `GET /api/income/forecast?from_date=` — next expected income (amount + date breakdown)

## Tests

```bash
cd backend
# Unit tests (no server needed)
python -m pytest tests/test_income_engine.py -k "not Integration"

# Full suite (requires backend on localhost:8001)
python -m pytest tests/
```
