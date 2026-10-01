import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.api import limiter
from app.db import get_db, make_engine
from app.main import app
from app.models import Base
from app.seed import seed
URL = os.environ.get('TEST_DATABASE_URL', 'sqlite://')
@pytest.fixture
def env():
    e = make_engine(URL, poolclass=StaticPool, connect_args={'check_same_thread': False}) if URL.startswith('sqlite') else make_engine(URL)
    Base.metadata.drop_all(e); Base.metadata.create_all(e); S = sessionmaker(e, expire_on_commit=False)
    def _db():
        with S() as s: yield s
    app.dependency_overrides[get_db] = _db; limiter.h.clear()
    with S() as s: seed(s)
    yield S
    app.dependency_overrides.clear(); Base.metadata.drop_all(e); e.dispose()
@pytest.fixture
def mk(env):
    def f(name):
        c = TestClient(app); r = c.post('/api/auth/register', json={'pseudonym': name, 'email': f'{name}@example.test', 'password': 'correct horse battery'}); assert r.status_code == 201, r.text; c.uid = r.json()['id']; return c
    return f
