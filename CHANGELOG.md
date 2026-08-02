# Changelog

All notable changes to Wallume are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.2b] — 2026-08-02

### Changed
- Home-screen widget now syncs immediately: the app pushes a widget update via `requestWidgetUpdate` whenever the Home screen loads data and whenever the app returns to the foreground (Android only auto-updates widgets every 30 min, so previously the widget lagged behind the app).

## [1.0.2a] — 2026-08-02

### Added
- **Income Template Engine**: 18 occupation templates (Office Employee, Government/BUMN, Factory Worker, Nurse, Doctor, Pharmacist, Retail/SPG, Sales Executive, Freelancer, Consultant, Driver, Teacher/Lecturer, Business Owner, Content Creator, Investor, Student, Unemployed, Custom) stored as JSON config — profession-agnostic engine with 14 calculation methods, 8 frequencies, payment-date + weekend/holiday rules.
- Onboarding income wizard (template pick → edit sources → schedule → forecast preview) with AI template suggestions via Groq.
- Income source CRUD + reorder + forecast API, income sources visible/manageable from Profile.
- Admin template CRUD (create/update/delete) via `/api/admin/income-templates`, gated by `ADMIN_EMAILS` env; DB overrides merge over JSON templates.

## [1.0.1b] — 2026-08-01

### Added
- Quick-add category from the transaction form: a "+ Add" button beside the category selector opens an inline bottom-sheet to create a category (name + type) without leaving the flow. The new category is saved via the same backend endpoint as the Categories screen and auto-selected in the form.

### Fixed
- Wedding plan checklist items: "Budget" and "Funds collected" (both the summary text and the input fields) are now stacked top/bottom instead of side-by-side, matching the summary card layout.

## [1.0.1a] — 2026-08-01

### Fixed
- Responsive layout: text and components now scale with screen width via a `scale()` utility (design reference 390dp). Typography in the shared design system and large inline values (transaction amount, net-worth hero, payday/title sizes) scale across common Android aspect ratios (18:9, 19.5:9, 20:9), preventing clipped/overlapping text on tall or narrow screens (e.g. Samsung).
- Bottom navigation bar now respects the system navigation bar inset (`useSafeAreaInsets`). The tab bar height and padding include `insets.bottom`, so icons are no longer covered by the device's 3-button or gesture navigation bar.

## [1.0.0-beta] — 2026-08-01 (revision 2)

### Changed
- Home-screen widget redesigned: two size variants (3x2 and 6x4). Both show net worth + income + a mini pie chart of expenses by category with legend. The large (6x4) variant additionally shows the Financial Health score as a percentage. The chart is rendered server-side as a PNG pie (Android widgets can't render interactive charts).
- All manual date text inputs replaced with a native calendar/date picker (transaction, recurring due date, goal target date, plan target date, investment purchase date, report date range).
- Fixed clipped "Recurring spend" amount text caused by line-height being smaller than font-size.

## [1.0.0-beta] — 2026-08-01

### Added
- Custom categories: users can add their own category names (any language) that flow into transactions and budgets.
- Home-screen widget now supports a large size variant with a server-rendered spending-by-category bar chart.
- Onboarding asks for the user's payday date and work schedule; payday reminders feed from it.
- New accounts start at 0 balance — no seed/dummy data.

### Changed
- Currency conversion (FX) now applies to all monetary sections (budgets, assets, debts, goals, recurring, plans, investments, reports), not just wallets.
- Wedding plan summary layout: Budget stacked above Funds collected.
- Payday date input switched from button presets to a calendar picker, with a work-week (5/6/7-day) preference.

### Fixed
- API client now unwraps the `{ success, data }` envelope so login/session restore works with the refactored backend.
- Auth body binding (login/signup) no longer broken by lazy annotations + rate-limit decorator.
- Budget spent matching fixed for date-only transaction dates.
- Wallet list shows converted home-currency balances.
- Backend deployment missing `Pillow` dependency for the widget chart endpoint.

### Security
- Rate limiting on login/signup, JWT revocation via blacklist, CORS restricted to known origins.
