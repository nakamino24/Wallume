# Changelog

All notable changes to Wallume are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.6c] — 2026-08-24 (HOTFIX — preview crash)

### Fixed
- **Preview crash `ReferenceError: Property 'useCallback' doesn't exist` in `ThemeProvider`** — `useCallback` was used but not imported; added missing import. Also fixed `app/transaction/new.tsx` missing `radius` import and stray `setFieldErrors` calls that broke `tsc` and would crash at runtime.

## [1.0.5c] — 2026-08-24 (HOTFIX — Reports date range filtering)

### Fixed
- **Reports showing wrong period (pie chart/data only from start of month to end date)** — `GET /api/transactions` accepted no date parameters, so `Reports` loaded the 500 most-recent transactions and filtered client-side. Any custom range that went beyond those 500 was silently incomplete. The API now accepts `from_date`/`to_date` (`$gte`/`$lte` on `date`) and `Reports` passes the selected range server-side, so the chart and totals reflect the exact period chosen.

### Changed
- Frontend `app.json` version bumped `1.0.6a → 1.0.6b`; backend version `1.0.5b → 1.0.5c`.

## [1.0.5b] — 2026-08-24 (HOTFIX — transaction writes 500 in production)

### Fixed
- **ALL transaction writes failing with HTTP 500 in production since v1.0.5a deploy (~Aug 20/21)** — regression introduced by `f16a9a9`, which threaded MongoDB sessions through `BaseRepository._collection()` via `Collection.with_options(session=...)`. pymongo's `with_options()` has never accepted a `session` kwarg, so every request that opened a transaction session raised `TypeError` mid-request. Blast radius (verified against live production): `POST /api/transactions` (income/expense/transfer creation), `PATCH /api/transactions/{id}` (edits), and `DELETE /api/transactions/{id}` all returned 500 unconditionally. All other endpoints (wallets, budgets, goals, plans, debts, investments, assets, categories, recurring incl. mark-paid, analytics, auth) were unaffected — no other code path passes sessions.
- **Sessions were silently dropped on writes** (same commit): even where the session was accepted, `insert_one`/`update_one` accepted the `session=` parameter but never forwarded it to the motor operation — meaning the "atomic" multi-document reverse/apply from v1.0.5a was never actually executing inside a transaction anywhere. Sessions are now passed per-operation (the correct motor API), so create/update/delete are genuinely atomic.

## [1.0.6a] — 2026-08-22 (timestamp & wallet detail correctness fixes)

### Follow-up hardening (same release, second batch)
- **Future-bug audit fixes** (2026-08-23 sweep): 
  (1) *Transaction edit could silently corrupt balances* — the update endpoint never verified that a changed `wallet_id`/`to_wallet_id` exists and belongs to the user; `adjust_balance()` is a no-op on a missing wallet, so the record moved but the money didn't. Both effective wallets are now validated inside the same atomic transaction. 
  (2) *Negative/zero amounts accepted at the API* — a negative expense would *increase* balance (double negation downstream). Amount is now validated as finite > 0 in the create schema (Pydantic) and on amount-changing updates; legacy bad records remain editable. 
  (3) *Empty-string date reintroduced full-ISO writes* — `date: ""` fell through to `now_utc().isoformat()`, silently regressing the mixed-format bug after migration; fallback is now canonical `YYYY-MM-DD` and unrecognized date strings are rejected (`strict_canonical_date`) instead of stored verbatim. 
  (4) *Recurring "Mark as paid" double-tap duplication* — each call logs one transaction, so rapid re-entry double-charged the wallet; list and detail screens now guard one payment in flight per item. 
  (5) *Test hygiene* — the empty-state Home test permanently overrode the wallets mock for the whole file; it now restores it.
- **Codebase Cleanup Pass**: Systematically removed dead code, unused imports/variables, and addressed `useEffect` dependency lint warnings (`app/transaction/new.tsx`, `src/auth/AppLockGate.tsx`, `app/(tabs)/coach.tsx`, `src/components/Skeleton.tsx`) to improve application stability and lint hygiene.
- **Improved Hook Hygiene**: Memoized `getOptions` in `useUserCategories` and standardized `useEffect` dependency arrays across multiple components to ensure effect stability.
- **DB date-format migration**: audit found the `transactions.date` field mixed 133 canonical `YYYY-MM-DD` values with 3 full-ISO strings (legacy recurring mark-paid default). One-time migration (`backend/scripts/migrate_tx_dates.py`) normalized all records with automatic backup + rollback support; rehearsed against a staging copy first (136→136 docs, order unchanged, zero loss). Post-migration: 136/136 canonical. Read-only auditor kept at `scripts/audit_tx_timestamps.py`.
- **Recurrence prevention at every write path**: new `to_canonical_date()` helper applied to transaction create/update and recurring mark-paid — full-ISO inputs are converted via their UTC calendar day so mixed formats can never re-enter the collection.
- **Device-local "today" everywhere**: form defaults, reports range presets, and edit fallbacks no longer derive dates through `toISOString()` (UTC), which silently picked *yesterday* for UTC+X devices between 00:00 and 06:59 local.
- **Timezone-explicit activity logic**: Wallet Activity grouping/time formatting extracted into pure modules (`src/lib/activity.ts`, `src/utils/dates.ts`) accepting an explicit IANA zone; covered by 25 deterministic multi-timezone tests simulating WIB (UTC+7), UTC, UTC-5, and DST-edge America/New_York (spring-forward + fall-back), including 23:59/00:01 day-boundary cases.
- **created_at coverage confirmed**: production audit shows 0 of 136 transactions lack `created_at`; the honest "no time shown" fallback for date-only records remains as defensive behavior but never triggers on real data.

### Fixed
- **Uniform "7:00 AM" timestamps in Wallet Recent Activity**: the activity rows fell back to `tx.date` when `created_at` was missing, and a date-only `"YYYY-MM-DD"` parsed via `new Date()` is interpreted as **UTC midnight** — which renders as 07:00 for UTC+7 users regardless of when the transaction was actually made. Rows now prefer `created_at` (the real save time) and show no time at all when only a bare date exists, instead of fabricating one.
- **Date-only strings parsed as UTC across the app** (`transactions.tsx`, `home.tsx` month filter, `export-report.tsx`, Wallet Activity grouping): date-only values now parse as *local* midnight (`YYYY-MM-DDT00:00:00`), so transactions can no longer land under the wrong calendar day or month for users outside UTC.
- **Transaction date lost when editing**: the edit screen pre-fills from route params, but none of the entry points (Home, Transactions, Wallet Activity) passed `date` — editing any transaction silently reset its date to today. All three now pass it through; the edit screen also normalizes full-ISO dates to `YYYY-MM-DD`.
- **Balance amount clipping on Wallet Detail**: the balance used a `Body` text with an overridden 32px font size while inheriting the component's fixed 22px line-height — on Android this clips tall glyphs and misaligns vertically. Replaced with the existing `DisplayNumber` component (auto-shrink to fit, correct line height), so amounts up to `Rp1.500.000.000+` stay fully readable without layout hacks.
- **Intra-day activity ordering safety net**: the database holds mixed date formats (date-only from the form vs full ISO from the backend default), which makes backend string-sorting ambiguous within a single day. Wallet Activity now re-sorts each date group by `created_at DESC, id DESC` as a deterministic tiebreaker on top of the backend's compound sort.
- **Misplaced loading skeleton in Home** (follow-up): the initial-load skeleton early-return had been nested inside the Upcoming map callback since ecceca6, triggering the long-standing `react/jsx-key` lint error; restored to a component-level guard, and the empty-state test no longer relies on a render race.

### Changed
- Version bumped `1.0.5a → 1.0.6a` in `app.json` (was stale after the v1.0.6 release).

## [1.0.6] — 2026-08-21

### Added
- **Wallet Recent Activity** — each wallet now shows its own transaction history (tap a wallet to view). Activity is correctly scoped: income shows `+amount`, expense shows `-amount`, transfers show the correct perspective (`-amount, Transfer to X` for source wallet; `+amount, Transfer from Y` for destination wallet). Grouped by date (TODAY, YESTERDAY, etc.) with time stamps. Reuses the existing transaction model — no new table or duplicate data.
- **Deterministic transaction ordering** — backend now sorts by `date DESC, created_at DESC, id DESC` so same-timestamp transactions have a stable, predictable order.

### Fixed
- **Recent Transaction ordering bug** — transactions were sorted only by `date DESC`, which meant same-date transactions had unpredictable order. Now uses compound sort (date, created_at, id) so newest-by-creation always appears first, even when transaction dates match.

## [1.0.5a] — 2026-08-09

### Fixed

- **Transfer balance corruption (root cause)**: `bson.Decimal128` does not support unary negation, so `-tx["amount"]` inside the delete/update reversal helpers raised a `TypeError` mid-way through — leaving one wallet reverted and the other not (or nothing reverted), plus a 500 error. Fixed by normalizing to a Python `Decimal` before negating (`app/utils/money.py::to_decimal`). Transfer create/update/delete now reverse/apply both wallet sides correctly and atomically, inside a MongoDB session transaction, so a partial reversal can never persist. Edit amount/wallet changes fully reverse the old effect before applying the new one. Delete is idempotent via the soft-deleted record (second delete 404s without touching balances). Same-wallet transfers are explicitly rejected.
- **Bottom nav bar covered by system navigation bar**: the tab bar now uses `max(insets.bottom, 48)` on Android (matching the standard 3-button nav height) so the icon+label area always sits above the nav bar even when an OEM under-reports the inset under edge-to-edge contrast mode (e.g. Samsung One UI). Paired with the `expo-navigation-bar` config (dark bar) so Android keeps the app edge-to-edge and reports insets correctly on every nav mode.

## [1.0.4a] — 2026-08-09 (bottom nav clearance fix)

### Fixed
- **Bottom nav bar labels squeezed against the system navigation bar (regression)**: the tab bar previously applied only `insets.bottom + 6` as bottom padding on Android, so the icon+label row sat just ~6dp above the 3-button system nav bar (gesture nav's smaller inset happened to hide it). The bar's `height` and `paddingBottom` now both grow by a shared clearance constant (`20` Android / `18` iOS) on top of the reported inset, so the full icon + label for every tab (Home, Wallets, Plan, Coach) keeps its size and sits comfortably clear of the system nav — scaling with whatever inset the device reports rather than a single fixed value. The Home "+" FAB is positioned relative to the screen area above the (now taller) tab bar, so it inherits the same clearance automatically.

## [1.0.4a] — 2026-08-07 (transaction UX polish: amount input, recent txs, category CRUD)

### Added
- **Category management CRUD (backend)** — `PATCH /api/categories/{id}` to rename a category (duplicate check per user+type, same as create, and re-labels any historical transactions using it), and a usage-aware `DELETE`:
  - If no transaction references the category → deletes normally.
  - If referenced without `?reassign_to=` → returns `409 Conflict` `{message:"in_use", count}` (never silently drops transaction data).
  - `DELETE /api/categories/{id}?reassign_to=<other_id>` bulk-reassigns matching transactions to another category, then deletes. Contained `CategoryUpdate` schema; added `count_by_category` / `update_category_for_user` on `TransactionRepository`.
- **Category CRUD modal (frontend)** — the create-only quick-add is now a full **Manage categories** sheet (reachable from the transaction form's category row "Manage" trigger): create, tap-to-rename inline, long-press-to-delete. A delete in use surfaces the reassign picker (move transactions to another category) before confirming. Wired via `api.updateCategory` / `api.deleteCategoryReassign`.
- **Recent Transactions edit/delete (Home)** — `TxRow` on Home now matches `/transactions`: tap opens the edit screen, long-press shows the same delete-confirm alert, and the list updates in place after a confirmed delete (no full reload).

### Fixed
- **Decimal/caret formatting in the amount input** — `MoneyInput` previously sized its caret by a digit offset into the *formatted* string (index mismatch once separators are inserted, and no handling for selection-range replacement), so mid-string insertions, backspace, paste, and select-replace could place the cursor at the wrong spot. Extracted a single shared engine `computeInputAmount` in `money.ts` that reasons entirely in raw-digit space and maps the caret back through `formatInputDigits`, and verified all 7 spec scenarios with unit tests in `__tests__/money.test.ts`.

### Migrated
- Removed the standalone Profile → Categories entry point and the `app/categories.tsx` page (category management is now done solely from the transaction form's manage sheet).

## [1.0.4a] — 2026-08-02 (interaction redesign)

### Added
- **MoneyInput** — reusable smart currency input (Rupiah live formatting, cursor-safe, leading-zero safe, empty stays empty, never remounts/loses focus). Reuses the existing `money.ts` formatter; no duplicated logic.
- **FormLayout** — shared safe-area + keyboard + scroll-aware form layout (header/back, KeyboardAvoidingView, ScrollView, dynamic bottom padding).
- **KeyboardAwareContainer** — centralized keyboard manager: any focused `Input`/`MoneyInput` auto-scrolls fully into view above the keyboard via a shared context. Replaces the ad-hoc `KeyboardScroll`.
- Centralized auto-scroll wired into the shared `Input` component — every form using it gets scroll-to-focused for free.

### Migrated
- All forms now use the shared `FormLayout` + `MoneyInput`: Transaction (new + edit), Budget, Goal (new + edit), Debt, Plan, Recurring, Investment, Wallet (new + edit).
- Wedding Plan checklist (`plan/[id]`) and Goal detail (`goal/[id]`) → centralized `KeyboardAwareContainer`.
- Removed the ad-hoc `KeyboardScroll` component (replaced by the centralized system).

### Fixed
- **Bug 1 — Widget pie chart collapsed to a single "Other" slice**: the widget analytics aggregation in `summary()` grouped only by month+type and never projected `category`, so every expense fell into an `"Other"` bucket (legend always showed one entry). `monthly_spending()` (the widget's PNG pie source) also filtered from *today* via `{date >= <today>}` instead of the 1st of the month, excluding the whole month. Both now project `category` (`$ifNull … "Other"`) and filter from month start, so the widget pie and legend reflect the real per-category breakdown (matching the in-app Reports screen, which groups raw transactions client-side).
- **Bug 2 Case A — "Add category" modal: keyboard fully occluded the input & new category never appeared**: the modal is an RN `<Modal>` (separate overlay hierarchy) whose `KeyboardAvoidingView` was a no-op on Android and had no scroll container, so the field was 100% invisible and the Save button was unreachable (its `submit` was never triggered via the keyboard). The modal now tracks real keyboard height, pads a `ScrollView` wrapper, and the input submits on the keyboard "done" action. Category creation now also updates the chip list optimistically (`useUserCategories.add`), so a new category appears immediately after saving.
- **Bug 2 Case B — Wedding Plan checklist "Add item" hidden below keyboard**: `KeyboardAwareContainer` now tracks the real keyboard height (all platforms) and scrolls the focused input to sit comfortably above it (previously a fixed `y - 90` offset with no keyboard height on Android), so the "Add item" field is fully visible above the keyboard.
- **Keyboard still covered "Note (optional)" / "Add item" — root-cause fix + app-wide rollout**: the shared `KeyboardAwareContainer` merged its keyboard-height bottom padding *before* each caller's `contentContainerStyle`, so `FormLayout`'s `paddingBottom` and `plan/[id]`'s `paddingBottom: 100` silently overrode it (Android's `behavior` is a no-op). The keyboard-height spacer is now rendered as an in-content element that cannot be overridden, and the focused input re-scrolls once the real keyboard height is known (not just at focus time). The same working pattern now covers every text input app-wide: `FormLayout` screens (transaction new/edit, budget, debt, goal, plan, recurring, investment, wallet), `plan/[id]` & `goal/[id]`, plus `login`, `signup`, `asset/new`, `categories`, and `debt-planner` — all migrated off raw `KeyboardAvoidingView`/`ScrollView` to `KeyboardAwareContainer`.
- **Transaction amount (nominal) polish**: `MoneyInput` gains a `hero` variant used by the transaction forms — the currency symbol renders inline at the same large displayBold size and baseline as the digits (previously a `24px` symbol next to a boxed `18px` input), centered, cursor-safe, and consistent for short (`Rp0`) and long (`Rp10.000.000`) values. Removed the dead local `scrollRef`/`onFocus` hack in the new-transaction form.

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
