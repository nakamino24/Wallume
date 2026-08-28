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

- **Backend:** `v1.0.5c` (`backend/app/main.py`)
- **Frontend:** `v1.0.6c` (`frontend/app.json`)
- **v1.0.7:** HELD — not created, no tag/release/production deploy. Current work targets **EAS Android PREVIEW** only.

## Quick Start

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
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

- Frontend `1.0.6c` and backend `1.0.5c` are the current version sources of truth.
- `v1.0.7` remains held and has not been created.
- Historical preview APKs are not advertised as current builds. Create and distribute a new internal preview only after the validation gate passes.
- CI performs validation only; it does not deploy to EAS or Railway.

## Documentation

- `CHANGELOG.md` — full release notes (1.0.6c)
- `ENGINEERING_BIBLE.md` — principles, architecture, standards
- `docs/` — additional product docs

## License

No open-source license is granted. All rights reserved.
