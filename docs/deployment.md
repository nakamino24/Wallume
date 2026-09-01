# Deployment — Wallume

## Backend (Railway)

### Auto-deploy
Railway is connected to the GitHub repository (`main` branch). Every push to `main` triggers an automatic deployment.

### Manual Deploy
```bash
git push origin main
```

### Health Check
`GET /api/` returns `{"success": true, "data": {"app": "Wallume", "status": "ok"}}`

### Environment Variables
Set in Railway dashboard:

| Variable | Required | Example |
|---|---|---|
| `MONGO_URL` | Yes | `mongodb+srv://...` |
| `DB_NAME` | Yes | `wallume` |
| `JWT_SECRET` | Yes | 64-char hex string |
| `GROQ_API_KEY` | No | `gsk_...` |
| `PASSWORD_RESET_ENABLED` | No | `true` only after the email settings below are ready |
| `PASSWORD_RESET_SECRET` | When reset enabled | Independent random secret, at least 32 characters; do not reuse `JWT_SECRET` |
| `PASSWORD_RESET_EMAIL_PROVIDER` | When reset enabled | `resend` |
| `PASSWORD_RESET_FROM_EMAIL` | When reset enabled | `Wallume <support@example.com>` using a verified sender |
| `RESEND_API_KEY` | When reset enabled | Resend secret API key |

Password recovery is disabled by default and uses Resend's HTTPS API when
enabled. OTP and reset-token lifetimes default to 10 minutes, the resend
cooldown defaults to 60 seconds, and OTP verification allows five attempts.
The backing `password_reset_challenges` collection and TTL index are created
by normal application startup; no manual data migration or user replacement is
required. Do not put any of these secret values in Expo public environment
variables or source control.

Password-reset request and resend delivery use FastAPI/Starlette
`BackgroundTasks` so generic API responses are not delayed by account-specific
lookups or Resend network latency. These tasks are process-local and are not a
durable queue: if the backend process stops after responding but before mail
delivery finishes, that email may not be sent. The user can safely request a
new code. A durable worker/queue can be considered if delivery scale or
reliability requirements increase; none is required at the current stage.

### Start Command
```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

Railway sets the `PORT` environment variable automatically.

### Procfile
```
web: uvicorn server:app --host 0.0.0.0 --port $PORT
```

## Frontend (Expo)

### Development
```bash
cd frontend
npx expo start
```

### Production Build (EAS)
```bash
cd frontend
eas build --platform ios      # iOS
eas build --platform android   # Android
eas build --platform all       # Both
```

### Web Build
```bash
cd frontend
npx expo export --platform web
```

### Environment Variables
Set in `frontend/.env`:

| Variable | Example |
|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | `https://victorious-enthusiasm-production.up.railway.app` |

## Database (MongoDB Atlas)

- Free tier M0 cluster.
- IP whitelist: allow all (0.0.0.0/0) for Railway access.
- Database user with read/write access to the `wallume` database.
- Connection string format: `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/`

## Monitoring

- Railway provides basic logs and metrics.
- Backend logs include `request_id`, `method`, `path`, `status`, `duration` for every request.
- MongoDB Atlas provides cluster metrics and slow query logging.
