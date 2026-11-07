# Wallume — Personal Finance Platform

Wallume is a personal finance app for wallets, transactions, budgets, goals, plans, recurring bills, investments, and financial health. The current release line is being hardened for an internal preview.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, Motor, MongoDB Atlas (Railway) |
| Frontend | Expo SDK 54, React Native 0.81, TypeScript 5.9, Expo Router |
| Auth | JWT + bcrypt + blacklist + rate limiting |
| Widget | `react-native-android-widget` (NetWorth) |
| Testing | Jest 29 + jest-expo (frontend), pytest (backend) |
| CI | GitHub Actions validation on pull requests and pushes to `main` |

## Project Structure

```
Wallume/
  backend/        # FastAPI clean architecture: routes → services → repositories → MongoDB
  frontend/       # Expo app: app/ (file routing) + src/ (api, auth, components, hooks, theme)
  docs/           # Product and engineering docs
  CHANGELOG.md    # Version history
  ENGINEERING_BIBLE.md
```

## Versions

Single source of truth, enforced by `backend/tests/test_version_consistency.py`:

- **Backend:** `backend/app/version.py` → `__version__`
- **Frontend:** `frontend/app.json` → `expo.version` (mirrored in `package.json`)
- Both are currently **`1.0.7a`** — the held `1.0.7` line, shipped as a preview.

The health endpoint reports build identity, so a deploy can be verified:

```bash
curl -s https://<backend>/api/ | jq .data
# { "version": "1.0.7a", "commit": "bae3569", "branch": "main", "environment": "production" }
```

If `commit` still shows an old SHA after a push, the deploy did not land —
that is the signal, rather than guessing from a version string.

## Quick Start

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
pytest                    # deterministic unit suite
pytest --run-integration  # requires live API + transaction-capable MongoDB
```

**Frontend**
```bash
cd frontend
yarn install --frozen-lockfile
yarn start          # Expo dev
yarn lint           # expo lint (0 errors expected)
yarn test --runInBand --testTimeout=30000
npx expo-doctor
npx tsc --noEmit
```

## Release Status

- Backend `backend/app/version.py` and frontend `app.json` are the version sources of truth; they must match (a test enforces it).
- Current line is `1.0.7a` — a preview iteration, not a tagged release. No git tags exist.
- Historical preview APKs are not advertised as current builds. Create and distribute a new internal preview only after the validation gate passes.
- CI performs validation only; it does not deploy to EAS or Railway. Railway deploys automatically from `main`.

## Documentation

- `CHANGELOG.md` — full release notes
- `ENGINEERING_BIBLE.md` — principles, architecture, standards
- `docs/` — additional product docs

## License

No open-source license is granted. All rights reserved.
