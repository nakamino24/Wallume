# Wallume Engineering Bible

## Mission

Build a production-grade personal finance platform that users trust with their money.

## Principles

1. **Reliability** — Financial data must never be lost or incorrect.
2. **Maintainability** — Code is read more than written. Prioritize clarity.
3. **Performance** — P50 < 80ms, P95 < 250ms for API responses.
4. **Security** — Every layer defends against unauthorized access.
5. **Simplicity** — Solve today's problem, not next year's.
6. **User Trust** — Privacy and data integrity are non-negotiable.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, Motor, MongoDB Atlas |
| Frontend | Expo SDK 54, React Native 0.81, TypeScript 5.9 |
| Auth | JWT + bcrypt + blacklist + rate limiting |
| Deployment | Railway (backend), EAS (frontend) |
| Testing | Jest 29 (frontend), pytest (backend) |

## Architecture

### Backend: Clean Architecture

```
API Layer (routes) → Service Layer (business logic) → Repository Layer (data access) → MongoDB
```

- Routes never contain business logic.
- Services never directly touch the database.
- Repositories never make business decisions.
- Dependencies are injected at runtime.

### Frontend: Feature-based

- `app/` — Expo Router pages (file-based routing).
- `src/` — Shared modules (api, auth, components, hooks, theme, utils).
- Components are reusable unless explicitly scoped to a single screen.

## Code Standards

### Backend
- Every function < 50 lines.
- Type hints required on all public functions.
- Docstrings on all service and repository methods.
- No `print()` — use structured logging.
- No magic values — constants in config.

### Frontend
- TypeScript strict mode.
- No `any` unless interfacing with untyped libraries.
- Component props must be typed (interface or type).
- Reuse `src/components/ui.tsx` — no ad-hoc button/styling.

## Database
- Money stored as `bson.Decimal128`, never `float`.
- Soft delete on all user data (`deleted_at` field).
- Indexes on `user_id` for all collections.
- Unique indexes on `email`, `user_id`, `session_token`, `jti`.

## Security
- Passwords hashed with bcrypt.
- JWT with `jti` for revocation.
- Rate limiting on login (10/min) and signup (5/min).
- CORS restricted to known origins.
- Tokens stored in device SecureStore (not AsyncStorage).

## Decision Records

| Date | Decision | Reason |
|---|---|---|
| 2026-07 | Clean Architecture backend | Maintainability, testability |
| 2026-07 | Decimal128 for money | Float rounding errors in financial data |
| 2026-07 | Soft delete | Data recovery, audit compliance |
| 2026-07 | Expo Router | File-based routing, web support |
| 2026-07 | Navy/Teal design system | Professional, not AI-generic |