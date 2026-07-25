"""
Wallume Backend — FastAPI + MongoDB.

Entry point. The application is defined in app.main.
Run with: uvicorn server:app --host 0.0.0.0 --port 8080
"""
from app.main import app
import uvicorn

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8080, reload=True)