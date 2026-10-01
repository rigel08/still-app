import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app import models as m
from app.main import app
from app.make_moderator import set_role
PW = 'correct horse battery'
def post(c, body='a reportable post'): r = c.post('/api/posts', json={'category': 'Feeling numb', 'body': body}); assert r.status_code == 201, r.text; return r.json()
def rep(c, t, reason='harassment', details='targeted me', kind='post'): r = c.post('/api/reports', json={'target_type': kind, 'target_id': t['id'], 'reason': reason, 'details': details}); assert r.status_code == 201, r.text
def queue(c, status='open'): r = c.get(f'/api/mod/reports?status={status}'); assert r.status_code == 200, r.text; return r.json()['items']
def go(c, r, action, note=None): return c.post(f"/api/mod/reports/{r['id']}/review", json={'action': action, 'note': note})
@pytest.fixture
def team(env, mk):
    a, b, md = mk('ann'), mk('bob'), mk('mod')
    with env() as s: set_role(s, 'mod@example.test', 'moderator')
    return a, b, md

def test_only_moderators_can_use_moderation_endpoints(env, team):
    ann, bob, mod = team; p = post(ann); rep(bob, p); anon = TestClient(app)
    for c, code in ((anon, 401), (ann, 403), (bob, 403)):
        assert c.get('/api/mod/reports').status_code == code and c.get('/api/mod/log').status_code == code and c.post('/api/mod/reports/1/review', json={'action': 'dismiss'}).status_code == code
    assert ann.get(f"/api/posts/{p['id']}").status_code == 200
    with env() as s: assert s.scalar(select(m.Report.status)) == 'open' and s.scalars(select(m.ModerationLog).where(m.ModerationLog.action == 'dismiss')).first() is None
    assert ann.get('/api/me').json()['role'] == 'user' and mod.get('/api/me').json()['role'] == 'moderator'

def test_users_cannot_grant_themselves_a_role(env, mk):
    c = mk('ann'); assert c.patch('/api/me/preferences', json={'role': 'moderator'}).status_code == 422
    assert TestClient(app).post('/api/auth/register', json={'pseudonym': 'sneaky', 'email': 's@example.test', 'password': PW, 'role': 'moderator'}).status_code == 422
    assert c.get('/api/me').json()['role'] == 'user' and c.get('/api/mod/reports').status_code == 403

def test_queue_shows_reason_details_content_date_status_but_not_the_reporter(env, team):
    ann, bob, mod = team; p = post(ann, 'the reported words'); rep(bob, p, 'spam', 'looks like an ad'); items = queue(mod); assert len(items) == 1; r = items[0]
    assert (r['reason'], r['details'], r['status'], r['target_type'], r['target_id']) == ('spam', 'looks like an ad', 'open', 'post', p['id']) and r['created_at'] and r['reviewed_at'] is None
    assert r['target'] == {'author': 'ann', 'category': 'Feeling numb', 'body': 'the reported words', 'content_status': 'active'}
    assert 'bob' not in mod.get('/api/mod/reports').text and queue(mod, 'reviewed') == [] and len(queue(mod, 'all')) == 1

def test_reviewed_and_dismiss_update_status_and_keep_content_visible(env, team):
    ann, bob, mod = team; p1, p2 = post(ann, 'first post'), post(ann, 'second post'); rep(bob, p1); rep(bob, p2); r1, r2 = queue(mod)
    a = go(mod, r1, 'reviewed', 'looked fine').json(); assert a['status'] == 'reviewed' and a['reviewed_by'] == 'mod' and a['reviewed_at']
    assert go(mod, r2, 'dismiss').json()['status'] == 'dismissed' and queue(mod) == [] and {x['status'] for x in queue(mod, 'all')} == {'reviewed', 'dismissed'}
    assert ann.get(f"/api/posts/{p1['id']}").status_code == 200 and ann.get(f"/api/posts/{p2['id']}").status_code == 200
    assert go(mod, r1, 'dismiss').status_code == 409 and mod.post('/api/mod/reports/9999/review', json={'action': 'dismiss'}).status_code == 404
    assert go(mod, r2, 'delete').status_code == 422 and go(mod, r2, 'dismiss', 'x' * 501).status_code == 422

def test_remove_content_hides_post_everywhere_and_closes_duplicate_reports(env, team, mk):
    ann, bob, mod = team; cara = mk('cara'); p = post(ann, 'harmful words'); rep(bob, p); rep(cara, p, 'other', 'also bad'); cara.put(f"/api/saved/post/{p['id']}")
    r1, r2 = queue(mod); o = go(mod, r1, 'remove_content', 'violates rules').json(); assert o['status'] == 'actioned' and o['target']['content_status'] == 'removed'
    assert {x['status'] for x in queue(mod, 'all')} == {'actioned'} and queue(mod) == []
    for c in (ann, bob, cara, mod): assert c.get(f"/api/posts/{p['id']}").status_code == 404 and p['id'] not in [x['id'] for x in c.get('/api/posts').json()['items']]
    assert cara.get('/api/saved/posts').json()['items'] == [] and cara.post(f"/api/posts/{p['id']}/replies", json={'body': 'hi'}).status_code == 404
    with env() as s: assert s.get(m.Post, p['id']).status == 'removed'

def test_remove_content_on_a_reply(env, team, mk):
    ann, bob, mod = team; cara = mk('cara'); p = post(ann); rid = bob.post(f"/api/posts/{p['id']}/replies", json={'body': 'nasty reply'}).json()['id']
    assert len(cara.get(f"/api/posts/{p['id']}").json()['reply_list']) == 1; rep(ann, {'id': rid}, kind='reply'); [r] = queue(mod)
    assert r['target_type'] == 'reply' and r['target']['body'] == 'nasty reply' and r['target']['author'] == 'bob' and go(mod, r, 'remove_content').status_code == 200
    d = cara.get(f"/api/posts/{p['id']}").json(); assert d['reply_list'] == [] and d['replies'] == 0

def test_actions_are_written_to_the_audit_log(env, team):
    ann, bob, mod = team; ps = [post(ann, f'post {i}') for i in range(3)]; [rep(bob, p) for p in ps]; rs = queue(mod)
    for r, (act, note) in zip(rs, [('reviewed', 'ok'), ('dismiss', None), ('remove_content', 'bad')]): assert go(mod, r, act, note).status_code == 200
    log = mod.get('/api/mod/log').json(); acts = [x for x in log if x['action'] != 'grant_role']
    assert [x['action'] for x in acts] == ['remove_content', 'dismiss', 'reviewed'] and all(x['moderator'] == 'mod' and x['created_at'] and x['target_type'] == 'post' for x in acts)
    assert acts[0]['note'] == 'bad' and acts[1]['note'] is None and acts[0]['report_id'] == rs[2]['id'] and acts[0]['target_id'] == ps[2]['id']
    g = [x for x in log if x['action'] == 'grant_role'][0]; assert g['moderator'] == '(server CLI)' and g['target_type'] == 'user' and g['target_id'] == mod.uid
    with env() as s: assert s.scalar(select(m.ModerationLog.moderator_id).where(m.ModerationLog.action == 'dismiss')) == mod.uid
    assert ann.get('/api/mod/log').status_code == 403

def test_audit_entries_survive_moderator_account_deletion(env, team):
    ann, bob, mod = team; p = post(ann); rep(bob, p); [r] = queue(mod); go(mod, r, 'dismiss')
    assert mod.request('DELETE', '/api/me', json={'password': PW}).status_code == 204
    with env() as s:
        e = s.scalars(select(m.ModerationLog).where(m.ModerationLog.action == 'dismiss')).one(); assert e.moderator_id is None and e.moderator == 'mod' and s.scalar(select(m.Report.reviewed_by)) is None

def test_set_role_grants_revokes_and_logs(env, mk):
    c = mk('ann')
    with env() as s:
        with pytest.raises(LookupError): set_role(s, 'nobody@example.test', 'moderator')
        with pytest.raises(ValueError): set_role(s, 'ann@example.test', 'admin')
        set_role(s, ' ANN@example.test ', 'moderator')
    assert c.get('/api/mod/reports').status_code == 200
    with env() as s: set_role(s, 'ann@example.test', 'user')
    assert c.get('/api/mod/reports').status_code == 403
    with env() as s: assert [x.action for x in s.scalars(select(m.ModerationLog).order_by(m.ModerationLog.id))] == ['grant_role', 'revoke_role']
