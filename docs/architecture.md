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
  - CURRENT: production fails on a default JWT secret, localhost/empty `MONGO_URL`, and empty/unsafe `DB_NAME`; development keeps local defaults.
- `create_indexes()` is safe startup (indexes only); migrations are explicit scripts `backend/scripts/migrations/YYYYMMDD_*.py` with `--dry-run/--apply`.
  - CURRENT: `create_indexes` safe, but `migrations/` runner not yet exists (only `tmp/` audits).

## API contract
All frontend calls via `frontend/src/api/client.ts:50` `req()`:
- Success: `{success:true, data: ...}` unwrapped to `data`.
- Error: thrown `err.status` (`401/403/404/409/422/429/5xx`) + `err.detail` + `err.message`, `network` when no status. UI translates at presentation layer (`auth.error.*`, `common.retry`).

Frontend `METHOD PATH` map is documented in `docs/api.md` (to be expanded to `src/api/types/`).

## Database compatibility
Mongo is schemaless. The compatibility rule is **READ OLD + READ NEW, WRITE NEW**.

- **Money**:
  - PROVEN HISTORICAL: numeric `int`/`float` values from releases before Decimal128 adoption (`f439750`).
  - CURRENT CANONICAL: new repository writes use `Decimal128`; `BaseRepository` reads expose API-safe numbers.
  - HYPOTHETICAL/REMOVED: a separate `normalize_money_value()` compatibility layer. Existing `money.py` and `BaseRepository` already own this boundary.

- **Dates**:
  - PROVEN HISTORICAL: three full-ISO transaction dates recorded by the `dc36fa2` migration/audit history.
  - CURRENT CANONICAL: repository reads normalize ISO dates without a database write; writers emit `YYYY-MM-DD` only.

- **Email**:
  - PROVEN HISTORICAL: signup has lowercased stored email since the backend service was introduced (`dec054f`).
  - CURRENT CANONICAL: `normalize_email(email) = email.strip().lower()` is used before exact indexed lookup and writes.
  - HYPOTHETICAL/REMOVED: mixed-case stored email fixtures and regex/collation login lookup.

- **User**:
  - PROVEN HISTORICAL: records predating later optional profile fields can omit them.
  - CURRENT CANONICAL: `UserRepository` supplies defaults on reads while preserving identity, credentials, provider, timestamps, and unknown fields.

Compatibility normalization lives at the repository boundary and never mutates Mongo during reads.

## Migration policy
**TARGET:** EXPAND → MIGRATE → VERIFY → CONTRACT. Each `backend/scripts/migrations/YYYYMMDD_*.py` supports `--dry-run/--apply` and reports `before/candidate/changed/skipped/error`. No auto-migration on API startup; `scripts/backups/` retained as audit. **CURRENT:** no `migrations/` runner yet; only `tmp/` audit scripts exist.

## Auth identity
- CURRENT: `user_id` remains stable, repository reads normalize optional fields, and `provider`/`password_hash`, bcrypt, JTI blacklist, SecureStore token, and login rate limit behavior are preserved.

## Money / Date rules
- CURRENT: new money writes use `Decimal128`; repository reads tolerate proven historical numeric forms. Transaction writers use `YYYY-MM-DD`; repository reads normalize proven ISO dates without changing ordering or stored data.

## Configuration
- CURRENT: `app/core/config.py` rejects unsafe production secrets/database configuration; `frontend/src/api/client.ts:4` remains the single `EXPO_PUBLIC_BACKEND_URL` source.

## Invariant (MANDATORY)
> Application updates must be backward-compatible with valid persisted data from supported historical Wallume versions. Readers may support legacy representations. Writers always emit the current canonical representation. Destructive migration requires an explicit reviewed migration.

## CI / Testing
- Frontend gate: `yarn install --frozen`, `expo install --check`, `expo-doctor 18/18`, `tsc --noEmit`, `lint`, `jest --runInBand` (29 suites 229 tests at baseline `52c3aa7`, including `locale-lifecycle`, `localization-audit`, `budgets`, `auth-refresh`, `auth-routing`).
  - CURRENT: green at `52c3aa7` (verified `2026-08-28`).
- Backend gate: `pytest` (requires `bson`/`motor`; CI installs the full environment).
- Compatibility tests in `backend/tests/compatibility/` exercise repository and auth-service paths; endpoint contracts live in `backend/tests/test_api_envelope.py`.
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
