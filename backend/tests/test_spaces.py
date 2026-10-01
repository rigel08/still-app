from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from app import models as m
from app.main import app
from app.make_moderator import set_role
PW = 'correct horse battery'; TEXT = 'You are doing better than you think today.'
def note(c, body=TEXT): r = c.post('/api/notes', json={'body': body}); assert r.status_code == 201, r.text; return r.json()
@pytest.fixture
def team(env, mk):
    a, b, md = mk('ann'), mk('bob'), mk('mod')
    with env() as s: set_role(s, 'mod@example.test', 'moderator')
    return a, b, md
def approve(md, n, act='approve'): return md.post(f"/api/mod/notes/{n['id']}/review", json={'action': act, 'note': None})

def test_quiet_room_counts_real_presence_only(env, mk):
    a, b, c = mk('ann'), mk('bob'), mk('cara'); assert TestClient(app).post('/api/quiet/join').status_code == 401 and a.get('/api/quiet').json() == {'present': 0, 'mine': False, 'window_seconds': 90}
    assert a.post('/api/quiet/join').json()['present'] == 1 and a.post('/api/quiet/join').json()['present'] == 1  # joining twice is one person
    j = b.post('/api/quiet/join').json(); assert j == {'present': 2, 'mine': True, 'window_seconds': 90}
    v = c.get('/api/quiet').json(); assert v['present'] == 2 and v['mine'] is False and set(v) == {'present', 'mine', 'window_seconds'} and 'ann' not in c.get('/api/quiet').text
    assert a.post('/api/quiet/leave').json() == {'present': 1, 'mine': False, 'window_seconds': 90} and b.post('/api/quiet/heartbeat').json()['mine'] is True

def test_quiet_room_presence_expires_and_old_records_are_pruned(env, mk):
    S = env; a, b = mk('ann'), mk('bob'); a.post('/api/quiet/join'); b.post('/api/quiet/join')
    with S() as s: s.execute(update(m.QuietSession).where(m.QuietSession.user_id == a.uid).values(last_seen_at=datetime.now(timezone.utc) - timedelta(seconds=200))); s.commit()
    assert b.get('/api/quiet').json()['present'] == 1 and a.post('/api/quiet/heartbeat').json()['mine'] is False
    with S() as s: s.execute(update(m.QuietSession).where(m.QuietSession.user_id == b.uid).values(last_seen_at=datetime.now(timezone.utc) - timedelta(days=8))); s.commit()
    a.post('/api/quiet/join')
    with S() as s: assert s.scalar(select(func.count()).select_from(m.QuietSession).where(m.QuietSession.user_id == b.uid)) == 0

def test_notes_validation_pending_visibility_and_anonymity(env, team):
    ann, bob, mod = team
    for body in ('short', 'x' * 281): assert ann.post('/api/notes', json={'body': body}).status_code == 422
    assert ann.post('/api/notes', json={'body': TEXT, 'author': 'x'}).status_code == 422 and TestClient(app).get('/api/notes/next').status_code == 401
    n = note(ann); assert n['status'] == 'pending' and bob.get('/api/notes/next').json() is None  # nothing is invented, and pending notes are not shown
    assert [x['status'] for x in ann.get('/api/notes/mine').json()] == ['pending'] and bob.get('/api/notes/mine').json() == []
    assert approve(mod, n).json() == {'status': 'approved'}; got = bob.get('/api/notes/next').json(); assert got == {'id': n['id'], 'body': TEXT}
    assert ann.get('/api/notes/next').json() is None and 'ann' not in bob.get('/api/notes/next').text

def test_only_moderators_review_notes_and_reviews_are_audited(env, team):
    ann, bob, mod = team; n1, n2 = note(ann), note(ann, 'Another kind note for whoever needs it.')
    for c, code in ((TestClient(app), 401), (ann, 403), (bob, 403)): assert c.get('/api/mod/notes').status_code == code and c.post(f"/api/mod/notes/{n1['id']}/review", json={'action': 'approve'}).status_code == code
    q = mod.get('/api/mod/notes').json(); assert [x['id'] for x in q] == [n1['id'], n2['id']] and all(set(x) == {'id', 'body', 'created_at'} for x in q)
    assert approve(mod, n1).status_code == 200 and approve(mod, n2, 'reject').status_code == 200 and approve(mod, n1).status_code == 409 and mod.post('/api/mod/notes/999/review', json={'action': 'approve'}).status_code == 404
    assert mod.post(f"/api/mod/notes/{n1['id']}/review", json={'action': 'delete'}).status_code == 422
    log = [x for x in mod.get('/api/mod/log').json() if x['action'].startswith('note_')]; assert [x['action'] for x in log] == ['note_reject', 'note_approve'] and all(x['moderator'] == 'mod' and x['target_type'] == 'note' for x in log)
    assert bob.get('/api/notes/next').json()['id'] == n1['id'] and {x['id']: x['status'] for x in ann.get('/api/notes/mine').json()} == {n1['id']: 'approved', n2['id']: 'rejected'}

def test_reported_notes_are_hidden_for_the_reporter_and_moderators_do_not_see_the_author(env, team, mk):
    ann, bob, mod = team; cara = mk('cara'); n = note(ann); approve(mod, n)
    assert bob.post('/api/reports', json={'target_type': 'note', 'target_id': n['id'], 'reason': 'harmful', 'details': 'unkind'}).status_code == 201 and ann.post('/api/reports', json={'target_type': 'note', 'target_id': n['id'], 'reason': 'spam'}).status_code == 400
    assert bob.get('/api/notes/next').json() is None and cara.get('/api/notes/next').json()['id'] == n['id']
    [r] = mod.get('/api/mod/reports').json()['items']; assert r['target_type'] == 'note' and r['target']['author'] is None and r['target']['body'] == TEXT and 'ann' not in mod.get('/api/mod/reports').text
    assert mod.post(f"/api/mod/reports/{r['id']}/review", json={'action': 'remove_content'}).status_code == 200 and cara.get('/api/notes/next').json() is None
    with env() as s: assert s.get(m.Note, n['id']).status == 'removed'

def test_notes_delete_ownership_rate_limit_and_account_deletion(env, team):
    S = env; ann, bob, mod = team; n = note(ann); approve(mod, n); bob.post('/api/reports', json={'target_type': 'note', 'target_id': n['id'], 'reason': 'spam'})
    assert bob.delete(f"/api/notes/{n['id']}").status_code == 404 and ann.request('DELETE', '/api/me', json={'password': PW}).status_code == 204
    with S() as s: assert s.scalar(select(func.count()).select_from(m.Note)) == 0 and s.scalar(select(func.count()).select_from(m.Report).where(m.Report.target_type == 'note')) == 0
    from app.api import limiter; limiter.h.clear()  # limits are keyed per client IP, and every test client shares one
    cara = TestClient(app); cara.post('/api/auth/register', json={'pseudonym': 'cara', 'email': 'c@example.test', 'password': PW}); codes = [cara.post('/api/notes', json={'body': f'A kind note number {i} for someone.'}).status_code for i in range(6)]
    assert codes == [201] * 5 + [429] and cara.delete('/api/notes/%d' % cara.get('/api/notes/mine').json()[0]['id']).status_code == 204

def test_export_includes_own_notes_and_sessions_only(env, team):
    ann, bob, mod = team; note(ann); ann.post('/api/quiet/join'); bob.post('/api/quiet/join'); ex = ann.get('/api/me/export').json()
    assert len(ex['notes']) == 1 and len(ex['quiet_sessions']) == 1 and bob.get('/api/me/export').json()['notes'] == []
