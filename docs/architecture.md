# Wallume Architecture

This document is the single concise reference for Wallume's intended boundaries after the `codex/architecture-stabilization` baseline (`52c3aa7`). It matches the current `ENGINEERING_BIBLE.md` and the actual `main` code.

## Frontend boundary
- `app/` — Expo Router pages. Compose screens from `src/` only. No direct `fetch` except `src/api/client.ts` and `src/widgets/refresh-widget.ts` (widget) and streaming `coach` chat.
  - CURRENT: true.
- `src/api/` — single contract `client.ts` (`req()` unwraps `{success,data}`).
  - CURRENT: `req()` exists and handles envelope/legacy flat, but DTOs are `any` (partial).
  - TARGET: `src/api/types/{auth,wallets,transactions,reports}.ts` typed DTOs.
- `src/auth/` — `AuthProvider` owns `user/status/token` (`initializing/authenticated/unauthenticated/temporarily-unavailable`). `AppState` retry on `temporarily-unavailable`.
  - CURRENT: implemented at `52c3aa7` (this stabilization).
- `src/components/` — reusable `ui.tsx` (`Chip minHeight 44`, `Card`, etc.). No business logic.
  - CURRENT: true (Chip `minHeight 44` fixed in `b970058`).
- `src/hooks/` — `use-payday`, `use-wallets` (cache), `use-transactions`. No direct DB.
  - CURRENT: true.
- `src/lib/` — `i18n` (`t()`), `categories` (`systemCategoryLabel`), `money`, `indonesian-holidays`. App-locale `id`/`en` via `I18nProvider` (`locale` bound `t`).
  - CURRENT: `t()` bound to `locale` in `I18nProvider.tsx:43` (`useCallback` dep `[locale]`), `systemCategoryLabel` exists.
- `src/theme/` — `tokens.palette` is single source for light/dark semantic colors (brand/success/error/warning/info). No hardcoded accent hex in screens.
  - CURRENT: true (vivid dark `4DE2B8/6EF2A6/FF7E85` at `52c3aa7`).
- `src/utils/` — pure `storage`, `responsive`, `money`.

## Backend boundary
```
HTTP/API (app/api/*.py) → Service (app/services/*.py) → Repository (app/repositories/*.py) → MongoDB (app/database/mongo.py)
```
- API: validate `schemas/models.py` (`SignupRequest` etc.), call service, map `HTTPException`, return `{success:true,data:...}`.
  - CURRENT: `api/resources.py: ~120-line get_report_summary` still contains business aggregation (violation).
- Service: business rules, orchestration, auth checks (`AuthService`, future `WalletsService` etc.). No `get_database()` outside repositories.
  - CURRENT: `AuthService.delete_account` still does `await get_database()` + `delete_many` loop (1 violation, `grep -r get_database`).
  - TARGET: `AccountRepository.delete_user_data(user_id)`; services never import `get_database`.
- Repository: `UserRepository`, `WalletRepository`, etc. — persistence + `deleted_at` active filter + normalization. No business decisions.
  - CURRENT: single file `repositories/repos.py` 847 lines mixing 10 repos (partial).
  - TARGET: split `repositories/{users,wallets,transactions,categories,planning}.py`.
- `app/core/config.py` is single backend config source (MONGO_URL, DB_NAME, JWT_SECRET).
  - CURRENT: validates `JWT_SECRET` default only; localhost/empty `MONGO_URL` not rejected (partial).
  - TARGET: production fails on `localhost`/`empty` `MONGO_URL` and unsafe `DB_NAME` too.
- `create_indexes()` is safe startup (indexes only); migrations are explicit scripts `backend/scripts/migrations/YYYYMMDD_*.py` with `--dry-run/--apply`.
  - CURRENT: `create_indexes` safe, but `migrations/` runner not yet exists (only `tmp/` audits).

## API contract
All frontend calls via `frontend/src/api/client.ts:50` `req()`:
- Success: `{success:true, data: ...}` unwrapped to `data`.
- Error: thrown `err.status` (`401/403/404/409/422/429/5xx`) + `err.detail` + `err.message`, `network` when no status. UI translates at presentation layer (`auth.error.*`, `common.retry`).

Frontend `METHOD PATH` map is documented in `docs/api.md` (to be expanded to `src/api/types/`).

## Database compatibility
Mongo is schemaless. **Target** is **READ OLD + READ NEW, WRITE NEW** (not yet fully implemented).

- **Money**:
  - CURRENT: `app/utils/money.py` tolerates `float/int/string/Decimal/Decimal128` on read via `to_decimal`, but repository normalization is ad-hoc (direct `Decimal128` in some paths).
  - TARGET: repository-boundary `normalize_money_value()` pure helper; new writes `Decimal128` only; legacy reads via repository.

- **Dates**:
  - CURRENT: canonical `YYYY-MM-DD` for new `transaction.date` (`todayLocalISO`), `groupTransactionsByDate` + `audit_tx_timestamps.py` already tolerates `YYYY-MM-DDTHH:mm:ss` legacy.
  - TARGET: explicit `normalize_transaction_document()` in repository; writer emits `YYYY-MM-DD` only.

- **Email**:
  - CURRENT: `signup/login` use `email.lower()` (no `strip()`), `find_by_email` uses lower only.
  - TARGET: `normalize_email(email) = email.strip().lower()` via single helper used in `signup/login/lookup/duplicate check`.

- **User**:
  - CURRENT: `user_id` immutable FK across collections; `provider` `email` vs `google/emergent` + `password_hash` presence determines login; missing optional `payday_day/work_week` defaulted in `AuthService` but not yet via repository normalization.
  - TARGET: `normalize_user_document()` in repository; same `user_id` preserved.

Normalization **TARGET** lives in repository layer, not screens. **CURRENT** is partial.

## Migration policy
**TARGET:** EXPAND → MIGRATE → VERIFY → CONTRACT. Each `backend/scripts/migrations/YYYYMMDD_*.py` supports `--dry-run/--apply` and reports `before/candidate/changed/skipped/error`. No auto-migration on API startup; `scripts/backups/` retained as audit. **CURRENT:** no `migrations/` runner yet; only `tmp/` audit scripts exist.

## Auth identity
- CURRENT: `user_id` stable, `provider` check via `password_hash` presence, `bcrypt` + `jti` blacklist + `SecureStore mf.token` + `10/min` limit preserved.
- TARGET: single `normalize_email` helper (see above) and `normalize_user_document()` for missing optional fields; same `user_id` preserved (verified by compatibility tests).

## Money / Date rules
- CURRENT: new `Decimal128` already, legacy tolerant via `to_decimal`; `YYYY-MM-DD` canonical with ISO tolerant read. No timezone fabrication (good).
- TARGET: strict writer + explicit repository normalization helpers (see above).

## Configuration
- CURRENT: `app/core/config.py` is single source but `validate_production_safety()` only checks `JWT_SECRET` default, **not** `MONGO_URL` localhost/empty or `DB_NAME` unsafe; `frontend/src/api/client.ts:4` is single source for `EXPO_PUBLIC_BACKEND_URL` with fallback (good).
- TARGET: `validate_production_safety()` must also reject `localhost` Mongo, empty `MONGO_URL`, unsafe `DB_NAME`; dev/test keep local defaults.

## Invariant (MANDATORY)
> Application updates must be backward-compatible with valid persisted data from supported historical Wallume versions. Readers may support legacy representations. Writers always emit the current canonical representation. Destructive migration requires an explicit reviewed migration.

## CI / Testing
- Frontend gate: `yarn install --frozen`, `expo install --check`, `expo-doctor 18/18`, `tsc --noEmit`, `lint`, `jest --runInBand` (29 suites 229 tests at baseline `52c3aa7`, including `locale-lifecycle`, `localization-audit`, `budgets`, `auth-refresh`, `auth-routing`).
  - CURRENT: green at `52c3aa7` (verified `2026-08-28`).
- Backend gate: `pytest` (requires `bson`/`motor`; CI has full env).
  - CURRENT: local `pytest` needs `.venv` (`pip install -r requirements.txt`); `python -m pytest` not run in this doc commit, but last `origin/main` CI was green.
- Compatibility fixtures: `tests/compatibility/` (planned) with sanitized `legacy user/tx/money` → new repo → valid model.
  - CURRENT: not yet existent (this phase will create `backend/tests/compatibility/`).
  - TARGET: 4 files `test_users/money/transactions/dates_compatibility.py`.
- Architecture drift: `git ls-tree -r HEAD -- frontend/android` must be empty (CNG), no `os.environ` outside `core/config`, no `fetch` outside `src/api` (except widget/coach streaming).
  - CURRENT: `frontend/android` removed in `95e49b8`, `expo-doctor` 18/18 PASS.

## Local dev
```
backend:  pip install -r requirements.txt; cp .env.example .env (set MONGO_URL, JWT_SECRET); uvicorn app.main:app --reload; pytest
frontend: yarn install --frozen-lockfile; echo EXPO_PUBLIC_BACKEND_URL=... > .env; yarn start; yarn test --runInBand
```
See `README.md` for canonical workflow.

## Deployment
`backend/Procfile` → `uvicorn app.main:app` (Railway), `backend/server.py` is Railway shim — keep. No committed `frontend/android` (CNG); `npx expo prebuild --clean` regenerates.
