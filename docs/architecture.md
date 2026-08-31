# Wallume Architecture

This document is the single concise reference for Wallume's intended boundaries after the `codex/architecture-stabilization` baseline (`52c3aa7`). It matches the current `ENGINEERING_BIBLE.md` and the actual `main` code.

## Frontend boundary
- `app/` — Expo Router pages. Compose screens from `src/` only. No direct `fetch` except `src/api/client.ts` and `src/widgets/refresh-widget.ts` (widget) and streaming `coach` chat.
- `src/api/` — single typed contract (`client.ts` + `types/*` future). All HTTP through `req()` which unwraps `{success,data}` and throws `err.status`.
- `src/auth/` — `AuthProvider` owns `user/status/token` (`initializing/authenticated/unauthenticated/temporarily-unavailable`). `AppState` retry on `temporarily-unavailable`.
- `src/components/` — reusable `ui.tsx` (`Chip minHeight 44`, `Card`, etc.). No business logic.
- `src/hooks/` — `use-payday`, `use-wallets` (cache), `use-transactions`. No direct DB.
- `src/lib/` — `i18n` (`t()`), `categories` (`systemCategoryLabel`), `money`, `indonesian-holidays`. App-locale `id`/`en` via `I18nProvider` (`locale` bound `t`).
- `src/theme/` — `tokens.palette` is single source for light/dark semantic colors (brand/success/error/warning/info). No hardcoded accent hex in screens.
- `src/utils/` — pure `storage`, `responsive`, `money`.

## Backend boundary
```
HTTP/API (app/api/*.py) → Service (app/services/*.py) → Repository (app/repositories/*.py) → MongoDB (app/database/mongo.py)
```
- API: validate `schemas/models.py` (`SignupRequest` etc.), call service, map `HTTPException`, return `{success:true,data:...}`.
- Service: business rules, orchestration, auth checks (`AuthService`, future `WalletsService` etc.). No `get_database()` outside repositories.
- Repository: `UserRepository`, `WalletRepository`, etc. — persistence + `deleted_at` active filter + normalization. No business decisions.
- `app/core/config.py` is single backend config source (MONGO_URL, DB_NAME, JWT_SECRET). Production fails loudly if missing; no silent localhost fallback.
- `create_indexes()` is safe startup (indexes only); migrations are explicit scripts `backend/scripts/migrations/YYYYMMDD_*.py` with `--dry-run/--apply`.

## API contract
All frontend calls via `frontend/src/api/client.ts:50` `req()`:
- Success: `{success:true, data: ...}` unwrapped to `data`.
- Error: thrown `err.status` (`401/403/404/409/422/429/5xx`) + `err.detail` + `err.message`, `network` when no status. UI translates at presentation layer (`auth.error.*`, `common.retry`).

Frontend `METHOD PATH` map is documented in `docs/api.md` (to be expanded to `src/api/types/`).

## Database compatibility
Mongo is schemaless. New code is **READ OLD + READ NEW, WRITE NEW**.

- **Money**: legacy `float/int/string/Decimal` → repository normalizes to `Decimal128` via `app/utils/money.py`; new writes `Decimal128` only.
- **Dates**: transaction `YYYY-MM-DD` canonical, but `YYYY-MM-DDTHH:mm:ss` legacy readable via `groupTransactionsByDate` + `audit_tx_timestamps.py`.
- **Email**: legacy case differences → `lower().strip()` via `normalize_email` helper (used in `signup/login/find_by_email`).
- **User**: `user_id` immutable foreign key across `wallets/transactions/...`; `provider` `email` vs `google/emergent` + `password_hash` presence determines login path; missing optional `payday_day/work_week` defaulted.
- Normalization lives in repository layer, not screens.

## Migration policy
EXPAND → MIGRATE → VERIFY → CONTRACT. Each `backend/scripts/migrations/*.py` supports `--dry-run`/`--apply` and reports `before/candidate/changed/skipped/error`. No auto-migration on API startup; `scripts/backups/` retained as audit.

## Auth identity
`user_id` (`user_*`) is stable. Email normalization is single helper. Existing `email/password` users with valid `password_hash` (`bcrypt`) remain authenticatable after updates; `provider` external accounts keep `password_hash=null` and correctly 401 on email login. `jti` blacklist + `SecureStore mf.token` + `10/min` login limit preserved.

## Money / Date rules
New `Decimal128` only; legacy reads tolerant. `YYYY-MM-DD` new, ISO legacy readable. No timezone fabrication; ordering preserved via `transactions` `date` string compare (chronology).

## Configuration
Backend `app/core/config.py` single source; frontend `EXPO_PUBLIC_BACKEND_URL` single source (`frontend/src/api/client.ts:4` fallback `victorious-enthusiasm...`). No duplicate hardcodes.

## Invariant (MANDATORY)
> Application updates must be backward-compatible with valid persisted data from supported historical Wallume versions. Readers may support legacy representations. Writers always emit the current canonical representation. Destructive migration requires an explicit reviewed migration.

## CI / Testing
- Frontend gate: `yarn install --frozen`, `expo install --check`, `expo-doctor 18/18`, `tsc --noEmit`, `lint`, `jest --runInBand` (29 suites 229 tests at baseline, including `locale-lifecycle`, `localization-audit`, `budgets`, `auth-refresh`).
- Backend gate: `pytest` (requires `bson`/`motor`; CI has full env).
- Compatibility fixtures: `tests/compatibility/` (planned) with sanitized `legacy user/tx/money` → new repo → valid model.
- Architecture drift: `git ls-tree -r HEAD -- frontend/android` must be empty (CNG), no `os.environ` outside `core/config`, no `fetch` outside `src/api` (except widget/coach streaming).

## Local dev
```
backend:  pip install -r requirements.txt; cp .env.example .env (set MONGO_URL, JWT_SECRET); uvicorn app.main:app --reload; pytest
frontend: yarn install --frozen-lockfile; echo EXPO_PUBLIC_BACKEND_URL=... > .env; yarn start; yarn test --runInBand
```
See `README.md` for canonical workflow.

## Deployment
`backend/Procfile` → `uvicorn app.main:app` (Railway), `backend/server.py` is Railway shim — keep. No committed `frontend/android` (CNG); `npx expo prebuild --clean` regenerates.
