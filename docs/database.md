# Database — Wallume

## Platform
MongoDB Atlas (M0 free tier or higher).

## Connection
Managed via `app/database/mongo.py`. Singleton `AsyncIOMotorClient` reused across the app.

## Collections

| Collection | Key Index | Purpose |
|---|---|---|
| `users` | `email` (unique), `user_id` (unique) | User profiles, password hash |
| `user_sessions` | `session_token` (unique), `expires_at` (TTL) | Session tokens |
| `token_blacklist` | `jti` (unique), `expires_at` (TTL) | Revoked JWT tokens |
| `wallets` | `user_id` | Financial accounts |
| `transactions` | `user_id` | Income/expense/transfer records |
| `budgets` | `user_id` | Monthly/yearly budget limits |
| `goals` | `user_id` | Saving goals |
| `plans` | `user_id` | Life event plans (wedding, house, etc.) |
| `debts` | `user_id` | Loans, credit cards, mortgages |
| `investments` | `user_id` | Stocks, crypto, mutual funds, bonds |
| `assets` | `user_id` | Physical assets (real estate, vehicle, etc.) |
| `recurring` | `user_id` | Recurring bills and subscriptions |
| `chat_messages` | `user_id` | AI Coach conversation history |

## Money Storage

All monetary values use **MongoDB Decimal128**, never float.

Money fields are auto-converted:
- **Write path**: `float → decimal.Decimal → bson.Decimal128` (handled by repository)
- **Read path**: `bson.Decimal128 → float` (2 decimal places, handled by repository)
- **Http response**: `float` via custom FastAPI JSON encoder

Money fields across all collections: `balance`, `amount`, `converted_balance`, `target_amount`, `saved_amount`, `total_budget`, `principal`, `remaining`, `interest_rate`, `monthly_payment`, `avg_cost`, `current_price`, `face_value`, `coupon_rate`, `purchase_price`, `current_value`, `value`.

## Soft Delete

User data is never permanently deleted on regular delete operations. Instead, `deleted_at` is set to the current UTC timestamp.

- `find` operations automatically filter `deleted_at: null`.
- Hard delete available via `hard=True` parameter (used only for account deletion).
- Expired sessions and blacklisted tokens use MongoDB TTL indexes for automatic cleanup.

## Indexes

Created on startup in `create_indexes()`:

```python
# Users
users.create_index("email", unique=True)
users.create_index("user_id", unique=True)

# Sessions & blacklist (TTL auto-cleanup)
user_sessions.create_index("expires_at", expireAfterSeconds=0)
token_blacklist.create_index("expires_at", expireAfterSeconds=0)

# All user-scoped collections
for coll in [wallets, transactions, budgets, goals, plans, debts, investments, assets, chat_messages, recurring]:
    coll.create_index("user_id")
```