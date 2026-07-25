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