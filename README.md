# Wallume — Personal Finance Platform

Wallume is a production-grade personal finance app: wallets, transactions, budgets, goals, plans, recurring bills, and financial health — with a calm, professional design system and reliable money handling.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, Motor, MongoDB Atlas (Railway) |
| Frontend | Expo SDK 54, React Native 0.81, TypeScript 5.9, Expo Router |
| Auth | JWT + bcrypt + blacklist + rate limiting |
| Widget | `react-native-android-widget` (NetWorth) |
| Testing | Jest 29 + jest-expo (frontend), pytest (backend) |

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

## Hotfix — UI Refinement (2026-08-25)

Latest main (`465b4d7`) refines the existing design direction frontend-only:

- **Transactions:** Full-screen chronological grouping via `TransactionDayGroup` + `groupTransactionsByDate()` (authority: `transaction.date`). Date header sits above each day's surface; row no longer repeats the full date (shows time/category/note/wallet + amount). Home Recent Transactions unchanged.
- **Plans / Financial Hub:** Compact switcher + sheet, reduced card heights, 36dp add buttons, progress-centric Plan cards, icon-only templates. No stock photos, no new backend fields.
- **Reports:** `transaction_count` now binds correctly to `summary.transaction_count` for every period (Last 7/30/90 days, This/Last month, custom) with explicit semantic colors (light + dark visible, no stale count, 0 handled as empty state).
- **Typography:** `Fraunces` (hero: Home balance, Reports net cash flow, restrained plan value) + `Inter` (UI, transaction amounts with `tabular-nums`). Loaded via `@expo-google-fonts/fraunces` + `inter` (strict — app halts on font load failure).
- **Dark theme:** Replaced green-dominant surfaces with a restrained graphite → midnight navy → indigo/plum gradient (`AppBackground` via `expo-linear-gradient`). Surfaces are solid charcoal/navy; teal/mint is accent-only. Bottom nav follows the gradient system.

Backend change: **NO** — Railway not redeployed (frontend-only).

## Preview Build

- EAS profile: `preview` (Android INTERNAL APK)
- Latest: `47f948d1-9355-424f-97ab-d6f223e02d0f` → https://expo.dev/artifacts/eas/ohwrMJLTqevRpQO9xDdBuKZTi20dKZqXqHIofDTnKSY.apk
- Previous: `8ad413f6-0689-4b8c-a917-a528551fce31` / `oLva3xOHUEqazILS7qV0IG9jhrEDULKxM-HJHwu_yJE.apk`

```bash
cd frontend
eas build --platform android --profile preview
```

## Documentation

- `CHANGELOG.md` — full release notes (1.0.6c)
- `ENGINEERING_BIBLE.md` — principles, architecture, standards
- `docs/` — additional product docs

## License

Private — all rights reserved.
