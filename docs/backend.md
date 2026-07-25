# Backend — Wallume

## Stack
- Python 3.11
- FastAPI
- Motor (async MongoDB driver)
- JWT (PyJWT)
- bcrypt
- SlowAPI (rate limiting)
- httpx (HTTP client for FX rates, Groq API)
- certifi (TLS certificates)

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app factory + lifespan
│   ├── api/                 # Route handlers
│   │   ├── auth.py          # Auth endpoints
│   │   ├── wallets.py       # Wallet CRUD
│   │   ├── transactions.py  # Transaction CRUD + balance adjustment
│   │   ├── resources.py     # Budgets, goals, plans, debts, investments, assets, recurring
│   │   ├── analytics.py     # Analytics summary
│   │   ├── coach.py         # AI Coach SSE streaming
│   │   └── router.py        # Aggregates all routers
│   ├── core/
│   │   └── config.py        # Pydantic Settings (env vars)
│   ├── database/
│   │   └── mongo.py         # Connection singleton + indexes
│   ├── schemas/
│   │   └── models.py        # All Pydantic request/response models
│   ├── repositories/
│   │   ├── base.py          # Generic CRUD + Decimal128 + soft delete
│   │   └── repos.py         # Entity-specific repositories
│   ├── services/
│   │   ├── auth_service.py  # Auth business logic
│   │   └── domain_services.py # Analytics, FX, debt, coach
│   ├── security/
│   │   └── auth.py          # JWT encode/decode + bcrypt
│   ├── middleware/
│   │   └── logging.py       # Request ID + duration logging
│   └── utils/
│       ├── helpers.py       # now_utc, new_id, clean_user, advance_date
│       └── money.py         # Decimal128 conversion + encoder
├── server.py                # Entry point (uvicorn)
├── tests/                   # Integration tests
├── requirements.txt
└── .env
```

## Conventions

- All routes return `{"success": bool, "data": dict | None}`.
- Error responses: `{"success": false, "message": str, "errors": []}`.
- Money values: stored as Decimal128, returned as float (2 decimal places).
- Timestamps: always UTC, ISO 8601 format.
- Pagination: use `limit` query param, default 100 for transactions, 500 for lists.

## Key Patterns

### Dependency Injection
```python
class MyService:
    def __init__(self) -> None:
        self.repo = MyRepository()
```

### Repository Pattern
```python
class UserRepository(BaseRepository):
    async def find_by_email(self, email: str) -> dict | None:
        return await self.find_one({"email": email})
```

### Service Pattern
```python
class MyService:
    async def do_something(self, authorization: str | None) -> dict:
        user = await self.auth.get_current_user(authorization)
        # business logic here
        return result
```

## Environment Variables
| Variable | Required | Description |
|---|---|---|
| `MONGO_URL` | Yes | MongoDB connection string |
| `DB_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | JWT signing key |
| `GROQ_API_KEY` | No | For AI Coach feature |