# Wallume Income Template Engine

## Overview

Wallume lets users set up their income by choosing an **occupation preset** that
auto-configures a list of **Income Sources** plus payroll config — no nominal
amounts required at setup (amounts are entered later when the user logs real
income). The underlying **Income Engine** is fully generic — it never knows
profession names. Presets are pure configuration data (JSON files); adding a new
occupation or country is a new JSON file, **no engine code changes**.

Layer order (do not collapse):

```
Occupation Preset (JSON config: name, category, icon, confidence, country, sources)
  └─> Income Source[]            (user-owned, editable / reorderable)
        └─> Calculation Method   (14 methods)
              └─> Schedule       (8 frequencies)
                    └─> Rules    (Payment Date Rule + Weekend Rule + Company Working Calendar)
                          └─> Income Engine  (profession-agnostic)
```

## Where things live

| Piece | Location |
|---|---|
| 25 occupation presets (config) | `backend/app/data/templates/*.json` |
| Preset generator (build tool) | `backend/app/data/templates/generate_templates.py` |
| Company Working Calendar (holidays) | `backend/app/data/holidays.py` |
| Income Engine | `backend/app/services/income_engine.py` |
| Income service (apply/CRUD/forecast/AI) | `backend/app/services/income_service.py` |
| Income API | `backend/app/api/income.py` |
| Smart onboarding UI | `frontend/app/income-setup.tsx` |
| Editable generated-config screen | `frontend/app/income-sources.tsx` |

## Template JSON structure

Each file is one preset. Metadata drives the onboarding UX (search, grouping,
favorites, confidence). **No business logic** lives in the file.

```jsonc
{
  "id": "bank_employee",
  "name": "Bank Employee",
  "country": "ID",                 // country-specific sets (ID now, SG/JP/US later)
  "category": "Office / Professional",
  "icon": "cash",                  // Ionicons name
  "confidence": 95,                // 0-100; <80 shows "estimated" note in preview
  "workWeekDefault": 5,            // presets user profile work_week (5/6/7)
  "paydayDayDefault": 25,          // presets user profile payday_day (editable)
  "incomeSources": [
    {
      "name": "Monthly Salary",
      "calculationMethod": "fixed_amount",
      "frequency": "monthly",
      "expectedPaymentDate": { "type": "fixed_date", "day": 25 },
      "adjustmentRules": [{ "type": "weekend_rule", "value": "previous_business_day" }],
      "forecastRules": {},
      "currency": "IDR",
      "taxStatus": "taxable",
      "recurring": true
      // NO amount — user enters real income later
    }
  ]
}
```

### Salary date is a suggestion, not fixed

`paydayDayDefault` only pre-fills the user's salary date. The user can edit it
with a date picker in the onboarding preview; the change persists as their
profile `payday_day`, and the engine still applies the Weekend/Holiday rule to
the user-provided date.

### Calculation methods (14)

`fixed_amount`, `hourly`, `daily`, `weekly`, `monthly`, `semi_monthly`,
`biweekly`, `per_shift`, `per_visit`, `per_sale`, `per_project`, `percentage`,
`formula`, `manual`.

### Payment Date Rules

`fixed_date`, `last_calendar_day`, `last_business_day`, `first_business_day`,
`nth_weekday`, `manual`, `company_policy`.

### Frequencies

`daily`, `weekly`, `biweekly`, `semi_monthly`, `monthly`, `quarterly`, `annually`, `custom`.

## How to add a new occupation / country preset

1. Create `backend/app/data/templates/<your_id>.json` with the structure above
   (set `"country": "SG"` etc. for a different country set).
2. That's it — the engine reads the directory at request time. **No code changes.**
   (Optional: regenerate via `generate_templates.py`.)
3. Verify: `GET /api/income/templates` lists it, and
   `POST /api/income/templates/apply?template_id=<your_id>` applies it.

### Runtime admin CRUD (DB overrides)

Templates can also be managed at runtime (DB overrides win over JSON by `id`).
Gated to admin emails set via the `ADMIN_EMAILS` env var:

```
POST   /api/admin/income-templates           create
PATCH  /api/admin/income-templates/{id}      update
DELETE /api/admin/income-templates/{id}      delete
```

## Confidence system

Each preset carries a `confidence` score (e.g. Bank Employee 95%, Doctor 60%,
Freelancer 50%). On the onboarding preview, presets with confidence < 80 show:
"This is an estimated configuration based on common industry practices. You can
customize it at any time."

## API

- `GET /api/income/templates` — list all presets
- `GET /api/income/templates/{id}` — one preset
- `POST /api/income/templates/apply?template_id={id}` — apply (creates sources + presets work_week/payday)
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
