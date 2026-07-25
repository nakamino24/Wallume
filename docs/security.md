# Security — Wallume

## Authentication

### Password Storage
- Hashing: bcrypt with `gensalt()` (automatic salt, ~12 rounds).
- Never stored in plain text. Never logged.
- Minimum requirements: 8 characters, 1 uppercase, 1 number.

### JWT Tokens
- Algorithm: HS256.
- Expiry: 30 days.
- Contains: `sub` (user_id), `jti` (unique ID), `iat`, `exp`.
- **Revocation**: On logout, `jti` is added to `token_blacklist` collection.
- Every authenticated request checks blacklist before accepting token.

### Session Tokens (fallback)
- Used by Emergent OAuth flow.
- Stored in `user_sessions` collection with TTL index for auto-cleanup.

## Rate Limiting

| Endpoint | Limit | Method |
|---|---|---|
| All | 200/minute | Default slowapi limit |
| `/auth/login` | 10/minute | Explicit decorator |
| `/auth/signup` | 5/minute | Explicit decorator |

Implemented via SlowAPI with in-memory key tracking.

## CORS

Restricted to known origins (configured in `settings.allowed_origins`):

```
http://localhost:8081
http://localhost:8001
https://victorious-enthusiasm-production.up.railway.app
```

Credentials allowed. Methods: all. Headers: all.

## Client-Side Security

- Auth token stored in `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android).
- Biometric lock (Face ID / fingerprint) available as additional layer.
- App re-locks when returning from background.
- PDF export generated locally, shared via OS share sheet — never uploaded.

## Infrastructure

- All API traffic over HTTPS (enforced by Railway).
- MongoDB Atlas with TLS (certifi).
- Environment variables for all secrets — never hardcoded.
- `.env` files in `.gitignore`.

## Data Privacy

- No third-party data sharing.
- AI Coach sends financial summary to Groq API (not stored by Groq).
- Exchange rates fetched from public API (no personal data included).
- Account deletion removes all user data from all 11 collections.