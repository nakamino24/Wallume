# Matrix Finance — Product Requirements Document

## 1. Product Vision
A modern, mobile-first personal finance command center that goes far beyond budgeting. Track every dollar (income, expense, transfers), manage multiple wallets (cash, bank, credit cards, e-wallets), plan life milestones (wedding, house, car, vacation), grow investments, and receive AI-powered financial coaching — all in one elegant, minimal app inspired by Copilot Money, Monarch Money, YNAB, and Apple Wallet.

## 2. Target Users
- Beginners with zero financial knowledge
- Young employees, freelancers, students
- Couples, families, small business owners

## 3. Core Modules (v1 — shipped)
1. **Dashboard (Home)** — net worth hero, monthly income/expense/cash flow, financial health score (0–100), quick actions, recent transactions, filter chips.
2. **Wallets** — Apple Wallet-style stacked cards. Types: cash / bank / credit card / e-wallet / savings / investment. Long-press to delete.
3. **Transactions** — income/expense/transfer with categories & notes; auto-updates wallet balances.
4. **Budgets** — monthly category budgets with progress rings. Auto-computes spent from transactions.
5. **Goals** — saving goals with target amount, kind (emergency/car/vacation/education/gadget/business/general), contribution flow.
6. **Life Plans** — Wedding, House, Car, Vacation. Each plan gets a hero image, checklist of default items, per-item budget + paid tracking, progress bar.
7. **Debts** — loan / credit card / mortgage tracking with APR, remaining balance, payoff progress.
8. **Investments** — stock / crypto / gold / mutual fund / ETF / bond with quantity, avg cost, current price → live P/L.
9. **Assets** — real estate / vehicle / gadget / cash / receivable / other.
10. **Reports** — 6-month income vs expense bar chart, expense donut, ratios (saving rate, debt ratio, health score).
11. **AI Coach** — Streaming chat with Claude Sonnet 4.6, personalized to the user's actual financial state.
12. **Profile & Settings** — light/dark mode, currency selector (12 currencies), sign out.

## 4. Technical Architecture
- **Frontend**: Expo SDK 54, React Native, expo-router (file-based routing), react-native-svg, @gorhom/bottom-sheet, react-native-reanimated.
- **Backend**: FastAPI, motor (async MongoDB), all routes prefixed with `/api`.
- **Database**: MongoDB with collections: users, user_sessions, wallets, transactions, budgets, goals, plans, debts, investments, assets, chat_messages. All use custom `id` field; `_id` is always excluded from responses.
- **Auth**: Dual — JWT (bcrypt password hashing, 30-day tokens) + Emergent-managed Google OAuth (7-day session tokens).
- **AI**: Emergent Universal LLM key + `emergentintegrations.llm.chat` streaming with Claude Sonnet 4.6.

## 5. Design System
- Personality: iOS-Native Clean × Glass/Luxe Dark
- Accent: Emerald `#10B981` (no blue, no purple)
- Typography: Space Grotesk (display/numbers) + Plus Jakarta Sans (body) — loaded from Fontsource jsDelivr CDN
- 4-tab bottom nav: Home · Wallets · Plan · Coach
- Multi-currency: USD, EUR, GBP, JPY, IDR, INR, SGD, AUD, CAD, VND, CNY, AED

## 6. Financial Engine
Real-time calculation of:
- Net worth = wallets + investments + assets − debts
- Cash flow = monthly income − monthly expense
- Saving rate = cash_flow / income × 100
- Debt ratio = debt_total / (wallets + investments + assets) × 100
- Health score (0–100) blend of saving rate, debt ratio, investment presence, asset presence
- Category breakdown (this month) + 6-month trend

## 7. Success Metrics
- Time to first transaction < 30s after signup
- New user auto-seeded with 2 wallets + 4 budgets so the dashboard is never empty
- < 3 taps to add income / expense / transfer

## 8. Roadmap (post-MVP)
- Receipt OCR + AI spending categorization
- Recurring transactions & bill reminders
- CSV / Excel import & export
- Family sharing & multi-user households
- Bank account sync (Plaid)
- Push notifications for over-budget alerts (requires user opt-in)
- Advanced planners: retirement calculator, mortgage amortization
