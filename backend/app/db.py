from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from .config import settings
def make_engine(url, **kw):
    e = create_engine(url, pool_pre_ping=True, **kw)
    if url.startswith('sqlite'):
        @event.listens_for(e, 'connect')
        def _fk(c, _): c.execute('PRAGMA foreign_keys=ON')  # enforce ON DELETE CASCADE in SQLite
    return e
engine = make_engine(settings.database_url)
SessionLocal = sessionmaker(engine, expire_on_commit=False)
def get_db():
    with SessionLocal() as s:
        yield s
