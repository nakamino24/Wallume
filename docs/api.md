# API — Wallume

## Base URL
Production: `https://victorious-enthusiasm-production.up.railway.app/api`

Local: `http://localhost:8001/api`

## Response Format

### Success
```json
{
    "success": true,
    "data": { ... }
}
```

### Error
```json
{
    "success": false,
    "message": "Human-readable error description",
    "errors": []
}
```

### Error Codes
| Code | Meaning |
|---|---|
| 400 | Validation error or bad request |
| 401 | Missing or invalid auth token |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Authentication

All endpoints except `/auth/login`, `/auth/signup`, and `/` require `Authorization: Bearer <token>` header.

Token format: JWT (HS256) with 30-day expiry.

Response includes `token` field on login/signup. Store in SecureStore.

## Standard Endpoints

### Auth
| Method | Path | Rate Limit | Notes |
|---|---|---|---|
| POST | `/auth/signup` | 5/min | Requires password (8+ chars, uppercase, number) |
| POST | `/auth/login` | 10/min | Returns JWT + user object |
| GET | `/auth/me` | — | Current user profile |
| PATCH | `/auth/me` | — | Update name, currency, theme, picture |
| DELETE | `/auth/me` | — | Permanently deletes account + all data |
| POST | `/auth/logout` | — | Revokes current JWT |

### Wallets
| Method | Path | Notes |
|---|---|---|
| GET | `/wallets` | List wallets (sorted by created_at) |
| POST | `/wallets` | Create wallet |
| PATCH | `/wallets/{id}` | Update wallet fields |
| DELETE | `/wallets/{id}` | Soft delete + cascade transactions |

### Transactions
| Method | Path | Notes |
|---|---|---|
| GET | `/transactions?type=&limit=` | Filter by type (income/expense/transfer) |
| POST | `/transactions` | Create + adjust wallet balance atomically |
| PATCH | `/transactions/{id}` | Reverse old, apply new balance |
| DELETE | `/transactions/{id}` | Reverse wallet balance |

### Budgets
| Method | Path | Notes |
|---|---|---|
| GET | `/budgets` | List budgets with computed `spent` via aggregation |
| POST | `/budgets` | Create budget |
| DELETE | `/budgets/{id}` | Soft delete |

### Goals, Plans, Debts, Investments, Assets, Recurring
Standard CRUD with same pattern as wallets.

### Analytics
| Method | Path | Notes |
|---|---|---|
| GET | `/analytics/summary` | Net worth, cash flow, health score, trends (single aggregation) |

### Debt Payoff
| Method | Path | Notes |
|---|---|---|
| GET | `/debts/payoff-plan?extra_monthly=` | Snowball + avalanche simulation |

### Coach
| Method | Path | Notes |
|---|---|---|
| POST | `/coach/chat` | SSE streaming response |
| GET | `/coach/history?session_id=` | Chat history for session |

## Money Format
All monetary values in API responses are `float` rounded to 2 decimal places. Internally stored as MongoDB Decimal128.