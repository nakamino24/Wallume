# Changelog

All notable changes to Wallume are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/).

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
