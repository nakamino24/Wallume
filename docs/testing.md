# Testing — Wallume

## Backend (pytest)

### Running Tests
```bash
cd backend
pytest tests/ -v
```

### Test Structure
Tests are integration-level — they send real HTTP requests to a running server.

**Prerequisites**: Backend must be running on `localhost:8001`.

### Test Files

| File | Coverage |
|---|---|
| `tests/conftest.py` | Fixtures: `api_client`, `auth_user`, `auth_headers` |
| `tests/test_backend_api.py` | Auth, Wallets, Transactions, Budgets, Goals, Plans, Debts, Investments, Assets, Analytics, Coach, Security (401 checks) |
| `tests/test_wallet_patch.py` | PATCH wallet regression tests |

### Test Flow
1. `auth_user` fixture signs up a fresh user with unique email.
2. Tests use the returned JWT token for authenticated requests.
3. Each test is self-contained (creates its own data).

### Adding Tests
```python
def test_my_feature(self, auth_headers):
    r = requests.get(f"{BASE_URL}/api/resource", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["success"] is True
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
Unit tests with mocked dependencies (Expo Router, API client, Auth, Theme, Storage).

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