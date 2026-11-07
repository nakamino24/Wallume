# Testing — Wallume

## Backend (pytest)

### Running Tests
```bash
cd backend
pytest            # deterministic suite — no network, no database
```

The default run is fully self-contained: no Mongo, no live API. Tests that
need infrastructure are skipped and say so.

### Two tiers

| Tier | Command | Needs |
|---|---|---|
| Deterministic | `pytest` | nothing |
| Integration | `MONGO_URL=... pytest --run-integration` | a MongoDB that supports transactions |

Integration files are listed in `LIVE_SERVICE_TEST_FILES` in
`tests/conftest.py` and auto-skipped without `--run-integration`.

### Running integration tests

Multi-document transactions require a replica set, so a standalone `mongod`
is not enough. A one-node replica set in Docker is sufficient:

```bash
docker run -d --rm --name wallume-rs --hostname mongo \
  --add-host mongo:127.0.0.1 -p 27019:27017 \
  mongo:7 --replSet rs0 --bind_ip_all
sleep 8
docker exec wallume-rs mongosh --quiet \
  --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]}).ok"

cd backend
MONGO_URL='mongodb://localhost:27019/?directConnection=true' pytest --run-integration

docker rm -f wallume-rs
```

What the integration tier actually verifies (and unit tests cannot):

- concurrent duplicate creates commit **one** effect and **one** idempotency
  record, and the transient `WriteConflict` is retried exactly as production
  does (`run_in_txn`);
- a failure injected mid-transaction rolls back the wallet, the transaction
  row and the idempotency record together;
- report aggregation is complete past 2000 rows and honours soft-delete;
- **tenancy**: joining a household re-scopes the joiner's documents across
  every scoped collection, and a personal household resolves to the owner's
  own id so pre-household data stays visible.

### Test Files

| File | Coverage |
|---|---|
| `tests/conftest.py` | Fixtures, integration gating, scope-cache isolation |
| `tests/test_backend_api.py` | Live API: auth, wallets, transactions, budgets, goals, plans, debts, investments, assets, analytics, coach, security |
| `tests/test_mongo_runtime_transactions.py` | Real Mongo: atomicity, rollback, concurrency, report aggregation |
| `tests/test_tenancy*.py` | Household invariants (unit) + real-DB re-scoping (integration) |
| `tests/test_split_transactions.py` | Split expenses: one debit, one row per part, group delete |
| `tests/test_receipts.py` | Upload validation, size cap, ownership scoping |
| `tests/test_telemetry.py` | Sentry optional + PII redaction |

### Note on `pytest.ini`

`asyncio_mode = auto` is required: the integration tests use async fixtures,
and motor binds its executor to the event loop it is created in, so clients
must be constructed inside the test's loop.

### Adding Tests
```python
def test_my_feature(monkeypatch):
    # Stub get_current_user; include owner_id — production always sets it.
    monkeypatch.setattr(api.auth_service, "get_current_user",
                        AsyncMock(return_value={"user_id": "u1", "owner_id": "u1"}))
```

## Frontend (Jest)

### Running Tests
```bash
cd frontend
npm test
# or
npx jest
```

### Test Structure
Unit tests with mocked dependencies (Expo Router, API client, Auth, Theme, Storage, Sentry, notifications, image picker).

### Test Files

| File | Tests | Coverage |
|---|---|---|
| `__tests__/setup.ts` | Global mocks | Expo modules, storage, auth |
| `__tests__/auth.test.tsx` | 7 tests | Login renders, validation, submit, error display, redirect, signup renders |
| `__tests__/home.test.tsx` | 8 tests | Welcome message, quick actions, filter chips, health score, FAB, profile nav, insights, empty state |

### Test Patterns

**Rendering**:
```tsx
const { getByTestId, getByText } = render(<MyComponent />);
expect(getByTestId('my-test-id')).toBeTruthy();
```

**User Interaction**:
```tsx
fireEvent.press(getByTestId('my-button'));
fireEvent.changeText(getByTestId('my-input'), 'value');
```

**Async Assertions**:
```tsx
await waitFor(() => {
    expect(getByText('Expected text')).toBeTruthy();
});
```

### Mock Strategy
- `jest.mock('expo-router', ...)` — mock navigation.
- `jest.mock('@/src/api/client', ...)` — mock API responses.
- `jest.mock('@/src/auth/AuthProvider', ...)` — mock auth state.
- `jest.mock('@/src/theme/ThemeProvider', ...)` — mock colors.

### Adding Tests
Create `.test.tsx` files in `__tests__/`. Follow existing patterns for mocks and assertions.