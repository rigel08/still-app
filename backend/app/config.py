import os
class Settings:
    database_url = os.environ.get('DATABASE_URL', 'sqlite:///./still.db')  # dev fallback only; use PostgreSQL for real use
    cors_origins = [o.strip() for o in os.environ.get('CORS_ORIGINS', 'http://localhost:5173').split(',') if o.strip()]
    cookie_secure = os.environ.get('COOKIE_SECURE', 'false').lower() in ('1', 'true', 'yes')
    session_days = int(os.environ.get('SESSION_DAYS', '14'))
settings = Settings()
