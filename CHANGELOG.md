# Changelog

All notable changes to Wallume are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.4a] — 2026-08-02 (interaction redesign)

### Added
- **MoneyInput** — reusable smart currency input (Rupiah live formatting, cursor-safe, leading-zero safe, empty stays empty, never remounts/loses focus). Reuses the existing `money.ts` formatter; no duplicated logic.
- **FormLayout** — shared safe-area + keyboard + scroll-aware form layout (header/back, KeyboardAvoidingView, ScrollView, dynamic bottom padding).
- **KeyboardAwareContainer** — centralized keyboard manager: any focused `Input`/`MoneyInput` auto-scrolls fully into view above the keyboard via a shared context. Replaces the ad-hoc `KeyboardScroll`.
- Centralized auto-scroll wired into the shared `Input` component — every form using it gets scroll-to-focused for free.

### Migrated
- Transaction form and Budget form → `FormLayout` + `MoneyInput`.
- Wedding Plan checklist (`plan/[id]`) and Goal detail (`goal/[id]`) → centralized `KeyboardAwareContainer` (confirmed the "Add item" field is covered).
- Removed the ad-hoc `KeyboardScroll` component (replaced by the centralized system).

## [1.0.4a] — 2026-08-02

### Added
- **Centralized Indonesian money formatter** (`src/lib/money.ts`): single source of truth for all currency display. `formatMoney`/`formatMoneyFull` in tokens now delegate to it app-wide (e.g. `Rp4.200.000`, dot thousands, comma decimals only when required). `formatMoneyCompact` for analytics/charts (e.g. `Rp4,2M`). Live input formatting (`formatInputDigits`) applied to the transaction amount fields with cursor-safe digit handling.
- **Safe-area spacing hook** (`useBottomSpacing`/`useTopSpacing`): Home FAB and Toast now position themselves using `insets.bottom + designSpacing` instead of hardcoded pixels.

### Fixed
- Keyboard covering text inputs: `plan/[id].tsx` (Wedding checklist "Add item") and `goal/[id].tsx` use the shared `KeyboardScroll` wrapper (KeyboardAvoidingView + ScrollView + dismiss-on-drag), consistent with every other form.
- Bottom nav bar forced to normal flow (`position: relative`) so screens and floating buttons never overlap it, while keeping the safe-area inset in bar height/padding.

## [1.0.3b] — 2026-08-02

### Fixed
- **Bottom navigation bar overlap (regression)**: the tab bar is now forced to normal flow (`position: 'relative'`) so screen content and floating buttons (e.g. the Home "+") never scroll under or overlap it, while keeping the safe-area bottom inset in the bar height/padding so it renders fully above the system gesture/3-button navigation bar on all Android devices.
- **Keyboard covers text inputs**: `plan/[id].tsx` (Wedding Plan checklist "Add item") and `goal/[id].tsx` (contribute amount) now use a shared `KeyboardScroll` wrapper (KeyboardAvoidingView + ScrollView + dismiss-on-drag), matching the pattern already used by every other form (transaction, budget, recurring, categories, etc.).

### Removed
- Occupation-based income setup flow (occupation picker, income-source wizard) removed per simplification. Income setup is now just: choose work schedule (5/6/7-day) + payday date.

### Fixed
- Payday date picker: the calendar no longer rolls the 31st over to the 1st in 30-day months (picker now displays in January, which always has 31 days).
- Payday calculation clarified (unchanged logic, already correct): 5-day work → non-working-day payday paid on Friday (last working day); 6-day → paid on Saturday; 7-day → paid on the chosen date. National-holiday paydays shift to the previous day in all cases.

## [1.0.3a] — 2026-08-02

### Changed
- **Income Setup redesigned** into fast occupation-based smart onboarding (under 30s, no nominal input at setup):
  - Step 1: searchable occupation picker (25 presets) with search, favorites, and recently-used.
  - Step 2: smart auto-configuration reusing the existing Income Engine — no forms or salary input; multi-income occupations (Doctor, Freelancer…) auto-generate several sources.
  - Step 3: clean preview summary (primary income, expected payday, working days, weekend adjustment, source list) with confidence note for low-confidence presets and a "You can change these later" hint.
- **Confidence system**: each preset carries a confidence score; presets < 80% show an "estimated configuration" note.
- **Editable salary date**: preset date is only a default; user can edit it with a date picker on the preview. The edit persists as the user's `payday_day`, and the Weekend/Holiday rule still applies to the user-provided date.
- **25 occupation presets** (Bank Employee, Government ASN, BUMN, Factory Worker, Doctor, Nurse, Retail/SPG, etc.), config-only JSON with `country`, `category`, `icon`, `confidence` — adding a new country/occupation requires only a new JSON file.
- New **Income sources** management screen (`/income-sources`) for editing the generated config later.

## [1.0.2c] — 2026-08-02

### Changed
- Income setup: occupation selection is now a direct dropdown of the 18 templates. The AI job-description suggestion remains available as an optional helper.

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
