# Frontend — Wallume

## Stack
- Expo SDK 54
- React Native 0.81
- TypeScript 5.9 (strict mode)
- Expo Router (file-based routing)
- Jest 29 + @testing-library/react-native

## Project Structure

```
frontend/
├── app/                          # Pages (Expo Router)
│   ├── _layout.tsx               # Root: providers + ErrorBoundary
│   ├── index.tsx                 # Splash → auth/onboarding redirect
│   ├── (auth)/
│   │   ├── _layout.tsx           # Auth stack
│   │   ├── login.tsx             # Email/password + Google OAuth
│   │   ├── signup.tsx            # Registration
│   │   └── onboarding.tsx        # First-time walkthrough
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Bottom tab bar (Home/Wallets/Plan/Coach)
│   │   ├── home.tsx              # Dashboard (net worth, insights, recent txs)
│   │   ├── wallets.tsx           # Wallet list
│   │   ├── plan.tsx              # Budgets, goals, plans, debts, assets
│   │   └── coach.tsx             # AI Coach chat
│   ├── debt-planner.tsx          # Snowball/avalanche payoff plan
│   ├── portfolio.tsx             # Investment portfolio view
│   ├── profile.tsx               # Settings, security, delete account
│   ├── privacy.tsx               # Privacy policy
│   ├── reports.tsx               # Charts and trends
│   ├── export-report.tsx         # PDF generation + share
│   └── [resource]/new.tsx, [id].tsx  # CRUD forms
├── src/
│   ├── api/
│   │   └── client.ts             # HTTP client, token management
│   ├── auth/
│   │   ├── AuthProvider.tsx       # Auth context + login/signup/logout
│   │   └── AppLockGate.tsx        # Biometric lock gate
│   ├── components/
│   │   ├── ui.tsx                 # Design system (Button, Card, Input, etc.)
│   │   └── ErrorBoundary.tsx      # Crash fallback screen
│   ├── hooks/
│   │   ├── use-icon-fonts.ts
│   │   └── use-onboarding.ts      # Onboarding completion state
│   ├── theme/
│   │   ├── tokens.ts              # Colors, spacing, radius, fonts
│   │   └── ThemeProvider.tsx       # Light/dark mode context
│   ├── lib/
│   │   └── investmentKinds.ts     # Investment type definitions + metrics
│   └── utils/
│       ├── confirm.ts              # Cross-platform confirm dialog
│       └── storage/                # AsyncStorage + SecureStore wrapper
├── __tests__/                     # Jest tests
│   ├── setup.ts                   # Global mocks
│   ├── auth.test.tsx              # Auth flow tests (7 cases)
│   └── home.test.tsx              # Home screen tests (8 cases)
├── app.json                       # Expo configuration
├── jest.config.js
└── package.json
```

## Conventions

- Reuse `src/components/ui.tsx` components — never create ad-hoc buttons/inputs.
- Screen components in `app/` — shared components in `src/components/`.
- API calls go through `src/api/client.ts` — never `fetch()` directly.
- Auth state via `useAuth()` hook — never read token directly.
- Theme via `useTheme()` hook — never hardcode colors.
- Spaces: 4/8/12/16/24/32/48/64 only.
- Border radius: 8/12/16 only.
- Fonts: System (SF Pro on iOS, Roboto on Android).

## Navigation
- File-based routing via Expo Router.
- `app/index.tsx` handles auth/onboarding redirect logic.
- Tab bar: Home | Wallets | Plan | Coach.
- Modal screens: transaction/new, goal/new, etc.

## Testing
- Run: `npm test` (or `npx jest`).
- 15 test cases covering auth flow and home screen.
- Tests use mocks for API, auth, and storage modules.