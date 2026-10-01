import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from app import models as m
from app.main import app
PW = 'correct horse battery'
def count(S, M, **kw):
    with S() as s: return s.scalar(select(func.count()).select_from(M).where(*[getattr(M, k) == v for k, v in kw.items()]))
def post(c, body='a real thought', cat='Feeling numb'): r = c.post('/api/posts', json={'category': cat, 'body': body}); assert r.status_code == 201, r.text; return r.json()

def test_auth_flow(env):
    c = TestClient(app); assert c.get('/api/me').status_code == 401
    r = c.post('/api/auth/register', json={'pseudonym': 'ann', 'email': 'Ann@Example.test', 'password': PW}); assert r.status_code == 201
    assert 'password' not in r.text and 'hash' not in r.text and 'httponly' in r.headers['set-cookie'].lower()
    assert c.get('/api/me').json()['pseudonym'] == 'ann'
    assert c.post('/api/auth/logout').status_code == 204 and c.get('/api/me').status_code == 401
    assert c.post('/api/auth/login', json={'email': 'ann@example.test', 'password': 'wrong wrong wrong'}).status_code == 401
    assert c.post('/api/auth/login', json={'email': 'nobody@example.test', 'password': PW}).status_code == 401
    assert c.post('/api/auth/login', json={'email': 'ann@example.test', 'password': PW}).status_code == 200 and c.get('/api/me').status_code == 200
    with env() as s: assert PW not in s.scalar(select(m.User.password_hash)) and s.scalar(select(m.User.password_hash)).startswith('$argon2')

@pytest.mark.parametrize('body', [{'pseudonym': 'a', 'email': 'x@y.test', 'password': PW}, {'pseudonym': 'okname', 'email': 'nope', 'password': PW}, {'pseudonym': 'okname', 'email': 'x@y.test', 'password': 'short'}, {'pseudonym': 'okname', 'email': 'x@y.test', 'password': PW, 'admin': True}])
def test_register_validation(env, body): assert TestClient(app).post('/api/auth/register', json=body).status_code == 422
def test_duplicate_register(env, mk): mk('ann'); assert TestClient(app).post('/api/auth/register', json={'pseudonym': 'ANN', 'email': 'other@example.test', 'password': PW}).status_code == 409

def test_preferences(env, mk):
    c = mk('ann'); r = c.patch('/api/me/preferences', json={'low_energy': True, 'company': 'alone'}); assert r.status_code == 200
    j = c.get('/api/me').json(); assert j['low_energy'] is True and j['prefs']['company'] == 'alone' and j['prefs']['notifications'] is False
    assert c.patch('/api/me/preferences', json={'company': 'bogus'}).status_code == 422

def test_checkins_private(env, mk):
    a, b = mk('ann'), mk('bob'); cid = a.post('/api/checkins', json={'emotion': 'Numb'}).json()['id']
    assert a.post('/api/checkins', json={'emotion': 'Sad'}).status_code == 422
    assert [x['emotion'] for x in a.get('/api/checkins').json()] == ['Numb'] and b.get('/api/checkins').json() == []
    assert b.delete(f'/api/checkins/{cid}').status_code == 404 and len(a.get('/api/checkins').json()) == 1
    assert a.delete(f'/api/checkins/{cid}').status_code == 204 and TestClient(app).get('/api/checkins').status_code == 401

def test_journal_crud_and_isolation(env, mk):
    a, b = mk('ann'), mk('bob'); j = a.post('/api/journal', json={'body': 'private words'}).json()
    assert a.patch(f"/api/journal/{j['id']}", json={'body': 'edited'}).json()['body'] == 'edited'
    assert b.get('/api/journal').json() == [] and 'private words' not in b.get('/api/me/export').text
    assert b.patch(f"/api/journal/{j['id']}", json={'body': 'hijack'}).status_code == 404 and b.delete(f"/api/journal/{j['id']}").status_code == 404
    assert a.get('/api/journal').json()[0]['body'] == 'edited'
    assert not any('private' in x.text or 'edited' in x.text for x in [b.get('/api/posts'), b.get(f"/api/posts")])
    assert a.delete(f"/api/journal/{j['id']}").status_code == 204 and a.get('/api/journal').json() == []

def test_community_flow(env, mk):
    a, b = mk('ann'), mk('bob'); p = post(a); assert p['author'] == 'ann' and p['mine'] and 'likes' not in p
    assert [x['id'] for x in b.get('/api/posts').json()['items']] == [p['id']]
    assert b.put(f"/api/posts/{p['id']}/me-too").status_code == 204 and b.get(f"/api/posts/{p['id']}").json()['me_too'] is True and a.get(f"/api/posts/{p['id']}").json()['me_too'] is False
    assert b.put(f"/api/saved/post/{p['id']}").status_code == 204 and b.get('/api/saved').json() == [{'item_type': 'post', 'item_id': p['id']}] and a.get('/api/saved').json() == []
    rep = b.post(f"/api/posts/{p['id']}/replies", json={'body': 'me too'}).json(); assert a.get(f"/api/posts/{p['id']}").json()['replies'] == 1
    assert a.delete(f"/api/replies/{rep['id']}").status_code == 404 and b.delete(f"/api/replies/{rep['id']}").status_code == 204
    assert b.delete(f"/api/posts/{p['id']}").status_code == 404 and a.delete(f"/api/posts/{p['id']}").status_code == 204 and a.get(f"/api/posts/{p['id']}").status_code == 404
    assert b.get('/api/saved').json() == [] and post(a, cat='Feeling numb') and a.post('/api/posts', json={'category': 'nope', 'body': 'xyz'}).status_code == 422

def test_pagination_and_relevance(env, mk):
    a = mk('ann'); [post(a, f'post number {i}', 'Feeling lonely' if i == 0 else 'Feeling numb') for i in range(5)]
    pg = a.get('/api/posts?per=2').json(); assert len(pg['items']) == 2 and pg['has_more'] and pg['items'][0]['body'] == 'post number 4'
    assert a.get('/api/posts?per=2&prefer=Feeling lonely').json()['items'][0]['category'] == 'Feeling lonely'

def test_reports_and_blocks(env, mk):
    a, b = mk('ann'), mk('bob'); p = post(a)
    assert a.post('/api/reports', json={'target_type': 'post', 'target_id': p['id'], 'reason': 'spam'}).status_code == 400
    assert b.post('/api/reports', json={'target_type': 'post', 'target_id': p['id'], 'reason': 'spam'}).status_code == 201
    assert b.post('/api/reports', json={'target_type': 'post', 'target_id': p['id'], 'reason': 'spam'}).status_code == 200
    assert b.get('/api/posts').json()['items'] == [] and len(a.get('/api/posts').json()['items']) == 1 and count(env, m.Report) == 1
    p2 = post(a, 'second post'); assert b.put('/api/blocks/ann').status_code == 204 and b.get('/api/posts').json()['items'] == [] and b.get('/api/blocks').json() == ['ann']
    assert b.put('/api/blocks/bob').status_code == 400 and b.put('/api/blocks/ghost').status_code == 404
    assert b.delete('/api/blocks/ann').status_code == 204 and [x['id'] for x in b.get('/api/posts').json()['items']] == [p2['id']]

def test_activities(env, mk):
    c = mk('ann'); assert len(c.get('/api/activities').json()) == 10 and all(x['energy_level'] == 'Low' for x in c.get('/api/activities?energy=Low').json())
    assert c.put('/api/saved/activity/1').status_code == 204 and c.put('/api/saved/activity/999').status_code == 404
    assert c.post('/api/activities/1/complete', json={'reflection': 'nice'}).status_code == 201 and c.get('/api/completions').json()[0]['reflection'] == 'nice'
    assert mk('bob').get('/api/completions').json() == []

def test_export_is_own_data_only(env, mk):
    a, b = mk('ann'), mk('bob'); a.post('/api/journal', json={'body': 'ann secret'}); b.post('/api/journal', json={'body': 'bob secret'}); post(a)
    ex = a.get('/api/me/export'); assert ex.status_code == 200 and 'ann secret' in ex.text and 'bob secret' not in ex.text and 'password' not in ex.text

def test_delete_account_removes_data(env, mk):
    S = env; a, b = mk('ann'), mk('bob'); a.post('/api/journal', json={'body': 'ann secret'}); a.post('/api/checkins', json={'emotion': 'Lonely'}); a.put('/api/saved/activity/1'); a.put('/api/blocks/bob')
    p = post(a); b.post(f"/api/posts/{p['id']}/replies", json={'body': 'hi'}); b.put(f"/api/saved/post/{p['id']}"); b.put(f"/api/posts/{p['id']}/me-too")
    b.post('/api/journal', json={'body': 'bob secret'}); rp = b.post(f"/api/posts/{post(b, 'bobs post')['id']}/replies", json={'body': 'self'}).json(); a.post('/api/reports', json={'target_type': 'reply', 'target_id': rp['id'], 'reason': 'other'})
    assert a.request('DELETE', '/api/me', json={'password': 'wrong wrong wrong'}).status_code == 403 and a.get('/api/me').status_code == 200
    assert a.request('DELETE', '/api/me', json={'password': PW}).status_code == 204 and a.get('/api/me').status_code == 401
    for M, col in [(m.JournalEntry, 'user_id'), (m.CheckIn, 'user_id'), (m.Saved, 'user_id'), (m.Block, 'blocker_id'), (m.UserSession, 'user_id'), (m.Post, 'author_id'), (m.Reply, 'post_id')]:
        assert count(S, M, **{col: a.uid if col != 'post_id' else p['id']}) == 0, M.__name__
    assert count(S, m.User, id=a.uid) == 0 and count(S, m.Saved, user_id=b.uid, item_type='post') == 0 and count(S, m.Reaction) == 0
    assert count(S, m.JournalEntry, user_id=b.uid) == 1 and b.get('/api/me').status_code == 200 and count(S, m.Report, reporter_id=None) == 1  # reporter identity dropped, report kept for review
    assert TestClient(app).post('/api/auth/login', json={'email': 'ann@example.test', 'password': PW}).status_code == 401

def test_rate_limit(env):
    c = TestClient(app); codes = [c.post('/api/auth/login', json={'email': 'x@y.test', 'password': 'whatever whatever'}).status_code for _ in range(12)]
    assert codes[:10] == [401] * 10 and codes[-1] == 429

def test_cors_and_origin_guard(env, mk):
    c = mk('ann'); assert 'access-control-allow-origin' not in c.get('/api/health', headers={'Origin': 'https://evil.example'}).headers
    assert c.get('/api/health', headers={'Origin': 'http://localhost:5173'}).headers['access-control-allow-origin'] == 'http://localhost:5173'
    assert c.post('/api/journal', json={'body': 'x'}, headers={'Origin': 'https://evil.example'}).status_code == 403 and c.get('/api/journal').json() == []

def test_report_reasons_and_details(env, mk):
    a, b = mk('ann'), mk('bob'); p = post(a); base = {'target_type': 'post', 'target_id': p['id']}
    assert b.post('/api/reports', json={**base, 'reason': 'nonsense'}).status_code == 422 and b.post('/api/reports', json={**base, 'reason': 'spam', 'details': 'x' * 501}).status_code == 422
    assert b.post('/api/reports', json={**base, 'reason': 'impersonation', 'details': '  pretending to be me  '}).status_code == 201
    with env() as s: rp = s.scalars(select(m.Report)).one(); assert rp.reason == 'impersonation' and rp.details == 'pretending to be me' and rp.reporter_id == b.uid
    assert 'pretending' not in a.get(f"/api/posts/{p['id']}").text
    for i, r in enumerate(['harassment', 'harmful', 'spam', 'other']): assert b.post('/api/reports', json={'target_type': 'post', 'target_id': post(a, f'another {i}')['id'], 'reason': r}).status_code == 201

def test_saved_posts_endpoint_reaches_beyond_newest_page(env, mk):
    S = env; a, b = mk('ann'), mk('bob'); old = [post(a, f'old post {i}') for i in range(5)]
    for p in old: assert b.put(f"/api/saved/post/{p['id']}").status_code == 204
    with S() as s: s.add_all(m.Post(author_id=a.uid, category='Feeling numb', body=f'filler {i}') for i in range(25)); s.commit()
    assert not {p['id'] for p in old} & {x['id'] for x in b.get('/api/posts?per=20').json()['items']}  # saved posts are outside the newest 20
    pg1 = b.get('/api/saved/posts?per=2').json(); assert [x['body'] for x in pg1['items']] == ['old post 4', 'old post 3'] and pg1['has_more'] and all(x['saved'] for x in pg1['items'])
    pg3 = b.get('/api/saved/posts?per=2&page=3').json(); assert [x['body'] for x in pg3['items']] == ['old post 0'] and not pg3['has_more']
    assert a.get('/api/saved/posts').json()['items'] == [] and TestClient(app).get('/api/saved/posts').status_code == 401
    b.put('/api/blocks/ann'); assert b.get('/api/saved/posts').json()['items'] == []; b.delete('/api/blocks/ann')
    b.post('/api/reports', json={'target_type': 'post', 'target_id': old[4]['id'], 'reason': 'spam'}); assert 'old post 4' not in b.get('/api/saved/posts').text
