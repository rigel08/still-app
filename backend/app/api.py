import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import case, delete, func, or_, select
from sqlalchemy.orm import Session
from . import models as m
from .config import settings
from .db import get_db
from .security import DUMMY, digest, hash_pw, new_token, verify

Emotion = Literal['Numb', 'Lonely', 'Disconnected', 'Overwhelmed', 'Restless', 'Okay', 'Curious', 'Hopeful']
Cat = Literal['Feeling disconnected', 'Feeling lonely', 'Feeling numb', 'Life feels confusing', 'Wanting genuine friendship', 'Music and memories', 'Finding new interests', 'Just wanting company']
class In(BaseModel): model_config = ConfigDict(extra='forbid')
class Out(BaseModel): model_config = ConfigDict(from_attributes=True)
class Register(In): pseudonym: str = Field(pattern=r'^[A-Za-z0-9_]{3,24}$'); email: str = Field(pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$', max_length=254); password: str = Field(min_length=10, max_length=128)
class Login(In): email: str = Field(max_length=254); password: str = Field(max_length=128)
class UserOut(Out): id: int; pseudonym: str; low_energy: bool; prefs: dict; role: str
class PrefsIn(In): low_energy: bool | None = None; company: Literal['either', 'company', 'alone'] | None = None; theme: Literal['night', 'dusk'] | None = None; notifications: bool | None = None
class CheckInIn(In): emotion: Emotion; note: str | None = Field(None, max_length=500)
class CheckInOut(Out): id: int; emotion: str; note: str | None; created_at: datetime
class JournalIn(In): body: str = Field(min_length=1, max_length=10000)
class JournalOut(Out): id: int; body: str; created_at: datetime; updated_at: datetime
class PostIn(In): category: Cat; body: str = Field(min_length=3, max_length=600)
class ReplyIn(In): body: str = Field(min_length=1, max_length=500)
class ReplyOut(BaseModel): id: int; author: str; body: str; created_at: datetime; mine: bool
class PostOut(BaseModel): id: int; category: str; body: str; author: str; created_at: datetime; replies: int; me_too: bool; saved: bool; mine: bool  # no public reaction totals
class PostDetail(PostOut): reply_list: list[ReplyOut]
class PostPage(BaseModel): items: list[PostOut]; has_more: bool
class ReportIn(In): target_type: Literal['post', 'reply', 'note']; target_id: int; reason: Literal['harassment', 'spam', 'harmful', 'impersonation', 'other']; details: str | None = Field(None, max_length=500)
class CompleteIn(In): reflection: str | None = Field(None, max_length=1000)
class DeleteIn(In): password: str = Field(max_length=128)
class ActivityOut(Out): id: int; title: str; description: str; duration_minutes: int; energy_level: str; social_type: str; category: str

class Limiter:
    def __init__(s): s.h: dict[str, deque] = defaultdict(deque)  # per-process; use a shared store (e.g. Redis) with multiple workers
    def check(s, key, n, window):
        t, q = time.monotonic(), s.h[key]
        while q and t - q[0] > window: q.popleft()
        if len(q) >= n: raise HTTPException(429, 'Too many requests. Please slow down and try again shortly.')
        q.append(t)
limiter = Limiter()
def rl(name, n, window):
    def dep(req: Request): limiter.check(f'{name}:{req.client.host if req.client else "?"}', n, window)
    return Depends(dep)

COOKIE = 'still_session'
def current_user(req: Request, db: Session = Depends(get_db)) -> m.User:
    if t := req.cookies.get(COOKIE):
        if s := db.get(m.UserSession, digest(t)):
            exp = s.expires_at if s.expires_at.tzinfo else s.expires_at.replace(tzinfo=timezone.utc)
            if exp > datetime.now(timezone.utc) and (u := db.get(m.User, s.user_id)) and u.status == 'active': return u
    raise HTTPException(401, 'Not signed in')
def owned(db, model, id, u, col='user_id'):
    o = db.get(model, id)
    if not o or getattr(o, col) != u.id: raise HTTPException(404, 'Not found')  # 404, not 403: don't reveal other people's records exist
    return o
def start(db, resp, u):
    t = new_token(); db.add(m.UserSession(token_hash=digest(t), user_id=u.id, expires_at=datetime.now(timezone.utc) + timedelta(days=settings.session_days))); db.commit()
    resp.set_cookie(COOKIE, t, httponly=True, samesite='lax', secure=settings.cookie_secure, max_age=settings.session_days * 86400, path='/')

r = APIRouter(prefix='/api')
@r.get('/health')
def health(): return {'ok': True}
@r.post('/auth/register', response_model=UserOut, status_code=201, dependencies=[rl('reg', 10, 60)])
def register(b: Register, resp: Response, db: Session = Depends(get_db)):
    if db.scalar(select(m.User.id).where(or_(m.User.email == b.email.lower(), func.lower(m.User.pseudonym) == b.pseudonym.lower()))): raise HTTPException(409, 'That email or pseudonym is already in use.')
    u = m.User(pseudonym=b.pseudonym, email=b.email.lower(), password_hash=hash_pw(b.password), prefs={'company': 'either', 'theme': 'night', 'notifications': False}); db.add(u); db.commit(); start(db, resp, u); return u
@r.post('/auth/login', response_model=UserOut, dependencies=[rl('login', 10, 60)])
def login(b: Login, resp: Response, db: Session = Depends(get_db)):
    u = db.scalar(select(m.User).where(m.User.email == b.email.lower())); ok = verify(u.password_hash if u else DUMMY, b.password)
    if not (u and ok and u.status == 'active'): raise HTTPException(401, 'Email or password is incorrect.')
    start(db, resp, u); return u
@r.post('/auth/logout', status_code=204)
def logout(req: Request, resp: Response, db: Session = Depends(get_db)):
    if t := req.cookies.get(COOKIE): db.execute(delete(m.UserSession).where(m.UserSession.token_hash == digest(t))); db.commit()
    resp.delete_cookie(COOKIE, path='/')
@r.get('/me', response_model=UserOut)
def me(u: m.User = Depends(current_user)): return u
@r.patch('/me/preferences', response_model=UserOut)
def prefs(b: PrefsIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    ch = b.model_dump(exclude_none=True)
    if 'low_energy' in ch: u.low_energy = ch.pop('low_energy')
    u.prefs = {**u.prefs, **ch}; db.commit(); return u

@r.post('/checkins', response_model=CheckInOut, status_code=201)
def add_ci(b: CheckInIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    c = m.CheckIn(user_id=u.id, emotion=b.emotion, note=b.note); db.add(c); db.commit(); return c
@r.get('/checkins', response_model=list[CheckInOut])
def list_ci(u: m.User = Depends(current_user), db: Session = Depends(get_db)): return db.scalars(select(m.CheckIn).where(m.CheckIn.user_id == u.id).order_by(m.CheckIn.created_at.desc(), m.CheckIn.id.desc()).limit(500)).all()
@r.delete('/checkins/{id}', status_code=204)
def del_ci(id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)): db.delete(owned(db, m.CheckIn, id, u)); db.commit()

@r.post('/journal', response_model=JournalOut, status_code=201)
def add_j(b: JournalIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    j = m.JournalEntry(user_id=u.id, body=b.body); db.add(j); db.commit(); return j
@r.get('/journal', response_model=list[JournalOut])
def list_j(u: m.User = Depends(current_user), db: Session = Depends(get_db)): return db.scalars(select(m.JournalEntry).where(m.JournalEntry.user_id == u.id).order_by(m.JournalEntry.created_at.desc(), m.JournalEntry.id.desc())).all()
@r.patch('/journal/{id}', response_model=JournalOut)
def upd_j(id: int, b: JournalIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    j = owned(db, m.JournalEntry, id, u); j.body = b.body; db.commit(); return j
@r.delete('/journal/{id}', status_code=204)
def del_j(id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)): db.delete(owned(db, m.JournalEntry, id, u)); db.commit()

def blocked(u): return select(m.Block.blocked_id).where(m.Block.blocker_id == u.id)
def reported(u, t): return select(m.Report.target_id).where(m.Report.reporter_id == u.id, m.Report.target_type == t)
def post_ok(u): return [m.Post.status == 'active', m.Post.author_id.not_in(blocked(u)), m.Post.id.not_in(reported(u, 'post'))]
def reply_ok(u): return [m.Reply.status == 'active', m.Reply.author_id.not_in(blocked(u)), m.Reply.id.not_in(reported(u, 'reply'))]
def post_out(db, u, p) -> PostOut:
    n = db.scalar(select(func.count()).select_from(m.Reply).where(m.Reply.post_id == p.id, *reply_ok(u)))
    return PostOut(id=p.id, category=p.category, body=p.body, author=p.author.pseudonym, created_at=p.created_at, replies=n, me_too=db.get(m.Reaction, (u.id, p.id)) is not None, saved=db.get(m.Saved, (u.id, 'post', p.id)) is not None, mine=p.author_id == u.id)
def visible_post(db, u, id):
    p = db.scalar(select(m.Post).where(m.Post.id == id, *post_ok(u)))
    if not p: raise HTTPException(404, 'Not found')
    return p
def drop_refs(db, post_ids, reply_ids):
    db.execute(delete(m.Saved).where(m.Saved.item_type == 'post', m.Saved.item_id.in_(post_ids))); db.execute(delete(m.Saved).where(m.Saved.item_type == 'reply', m.Saved.item_id.in_(reply_ids)))
    db.execute(delete(m.Report).where(m.Report.target_type == 'post', m.Report.target_id.in_(post_ids))); db.execute(delete(m.Report).where(m.Report.target_type == 'reply', m.Report.target_id.in_(reply_ids)))

@r.post('/posts', response_model=PostOut, status_code=201, dependencies=[rl('post', 10, 60)])
def add_post(b: PostIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    p = m.Post(author_id=u.id, category=b.category, body=b.body.strip()); db.add(p); db.commit(); return post_out(db, u, p)
@r.get('/posts', response_model=PostPage)
def list_posts(category: Cat | None = None, prefer: Cat | None = None, page: int = Query(1, ge=1), per: int = 8, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    per = max(1, min(per, 20)); q = select(m.Post).where(*post_ok(u))
    if category: q = q.where(m.Post.category == category)
    if prefer: q = q.order_by(case((m.Post.category == prefer, 0), else_=1))  # relevance to the chosen feeling, then newest; never popularity
    rows = db.scalars(q.order_by(m.Post.created_at.desc(), m.Post.id.desc()).offset((page - 1) * per).limit(per + 1)).all()
    return PostPage(items=[post_out(db, u, p) for p in rows[:per]], has_more=len(rows) > per)
@r.get('/posts/{id}', response_model=PostDetail)
def get_post(id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    p = visible_post(db, u, id); rs = db.scalars(select(m.Reply).where(m.Reply.post_id == id, *reply_ok(u)).order_by(m.Reply.created_at, m.Reply.id)).all()
    return PostDetail(**post_out(db, u, p).model_dump(), reply_list=[ReplyOut(id=x.id, author=x.author.pseudonym, body=x.body, created_at=x.created_at, mine=x.author_id == u.id) for x in rs])
@r.delete('/posts/{id}', status_code=204)
def del_post(id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned(db, m.Post, id, u, 'author_id'); rids = db.scalars(select(m.Reply.id).where(m.Reply.post_id == id)).all(); drop_refs(db, [id], rids); db.delete(p); db.commit()
@r.post('/posts/{id}/replies', response_model=ReplyOut, status_code=201, dependencies=[rl('reply', 20, 60)])
def add_reply(id: int, b: ReplyIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    visible_post(db, u, id); x = m.Reply(post_id=id, author_id=u.id, body=b.body.strip()); db.add(x); db.commit()
    return ReplyOut(id=x.id, author=u.pseudonym, body=x.body, created_at=x.created_at, mine=True)
@r.delete('/replies/{id}', status_code=204)
def del_reply(id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    x = owned(db, m.Reply, id, u, 'author_id'); drop_refs(db, [], [id]); db.delete(x); db.commit()
@r.put('/posts/{id}/me-too', status_code=204)
def me_too(id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    visible_post(db, u, id)
    if not db.get(m.Reaction, (u.id, id)): db.add(m.Reaction(user_id=u.id, post_id=id)); db.commit()
@r.delete('/posts/{id}/me-too', status_code=204)
def un_me_too(id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)): db.execute(delete(m.Reaction).where(m.Reaction.user_id == u.id, m.Reaction.post_id == id)); db.commit()

@r.put('/saved/{item_type}/{item_id}', status_code=204)
def save(item_type: Literal['post', 'activity'], item_id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    if item_type == 'post': visible_post(db, u, item_id)
    elif not db.get(m.Activity, item_id): raise HTTPException(404, 'Not found')
    if not db.get(m.Saved, (u.id, item_type, item_id)): db.add(m.Saved(user_id=u.id, item_type=item_type, item_id=item_id)); db.commit()
@r.delete('/saved/{item_type}/{item_id}', status_code=204)
def unsave(item_type: Literal['post', 'activity'], item_id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(m.Saved).where(m.Saved.user_id == u.id, m.Saved.item_type == item_type, m.Saved.item_id == item_id)); db.commit()
@r.get('/saved/posts', response_model=PostPage)
def saved_posts(page: int = Query(1, ge=1), per: int = Query(20, ge=1, le=50), u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(m.Post).join(m.Saved, (m.Saved.item_id == m.Post.id) & (m.Saved.item_type == 'post') & (m.Saved.user_id == u.id)).where(*post_ok(u)).order_by(m.Saved.created_at.desc(), m.Post.id.desc()).offset((page - 1) * per).limit(per + 1)
    rows = db.scalars(q).all(); return PostPage(items=[post_out(db, u, p) for p in rows[:per]], has_more=len(rows) > per)
@r.get('/saved')
def saved(u: m.User = Depends(current_user), db: Session = Depends(get_db)): return [{'item_type': s.item_type, 'item_id': s.item_id} for s in db.scalars(select(m.Saved).where(m.Saved.user_id == u.id))]

@r.post('/reports', status_code=201, dependencies=[rl('report', 20, 60)])
def report(b: ReportIn, resp: Response, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    t = db.get({'post': m.Post, 'reply': m.Reply, 'note': m.Note}[b.target_type], b.target_id)
    if not t: raise HTTPException(404, 'Not found')
    if t.author_id == u.id: raise HTTPException(400, "You can't report your own content; delete it instead.")
    if db.scalar(select(m.Report.id).where(m.Report.reporter_id == u.id, m.Report.target_type == b.target_type, m.Report.target_id == b.target_id)): resp.status_code = 200; return {'status': 'already_reported'}
    db.add(m.Report(reporter_id=u.id, target_type=b.target_type, target_id=b.target_id, reason=b.reason, details=(b.details or '').strip() or None)); db.commit(); return {'status': 'received'}
def by_name(db, name): 
    t = db.scalar(select(m.User).where(m.User.pseudonym == name))
    if not t: raise HTTPException(404, 'Not found')
    return t
@r.put('/blocks/{pseudonym}', status_code=204)
def block(pseudonym: str, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    t = by_name(db, pseudonym)
    if t.id == u.id: raise HTTPException(400, "You can't block yourself.")
    if not db.get(m.Block, (u.id, t.id)): db.add(m.Block(blocker_id=u.id, blocked_id=t.id)); db.commit()
@r.delete('/blocks/{pseudonym}', status_code=204)
def unblock(pseudonym: str, u: m.User = Depends(current_user), db: Session = Depends(get_db)): db.execute(delete(m.Block).where(m.Block.blocker_id == u.id, m.Block.blocked_id == by_name(db, pseudonym).id)); db.commit()
@r.get('/blocks')
def blocks(u: m.User = Depends(current_user), db: Session = Depends(get_db)): return [x.pseudonym for x in db.scalars(select(m.User).where(m.User.id.in_(blocked(u))))]

@r.get('/activities', response_model=list[ActivityOut])
def activities(category: str | None = None, energy: Literal['Low', 'Medium'] | None = None, social: Literal['Solo', 'Social'] | None = None, db: Session = Depends(get_db)):
    q = select(m.Activity).order_by(m.Activity.id)
    for col, v in ((m.Activity.category, category), (m.Activity.energy_level, energy), (m.Activity.social_type, social)):
        if v: q = q.where(col == v)
    return db.scalars(q).all()
@r.post('/activities/{id}/complete', status_code=201)
def complete(id: int, b: CompleteIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    if not db.get(m.Activity, id): raise HTTPException(404, 'Not found')
    c = m.Completion(user_id=u.id, activity_id=id, reflection=b.reflection); db.add(c); db.commit(); return {'id': c.id}
@r.get('/completions')
def completions(u: m.User = Depends(current_user), db: Session = Depends(get_db)): return [{'id': c.id, 'activity_id': c.activity_id, 'reflection': c.reflection, 'created_at': c.created_at} for c in db.scalars(select(m.Completion).where(m.Completion.user_id == u.id).order_by(m.Completion.id.desc()))]

@r.get('/me/export')
def export(u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    own = lambda M, col='user_id': db.scalars(select(M).where(getattr(M, col) == u.id)).all()
    return {'user': {'pseudonym': u.pseudonym, 'email': u.email, 'low_energy': u.low_energy, 'prefs': u.prefs, 'created_at': u.created_at},
            'check_ins': [CheckInOut.model_validate(x) for x in own(m.CheckIn)], 'journal': [JournalOut.model_validate(x) for x in own(m.JournalEntry)],
            'posts': [{'id': x.id, 'category': x.category, 'body': x.body, 'created_at': x.created_at} for x in own(m.Post, 'author_id')],
            'replies': [{'id': x.id, 'post_id': x.post_id, 'body': x.body, 'created_at': x.created_at} for x in own(m.Reply, 'author_id')],
            'saved': [{'item_type': x.item_type, 'item_id': x.item_id} for x in own(m.Saved)], 'completions': [{'activity_id': x.activity_id, 'reflection': x.reflection, 'created_at': x.created_at} for x in own(m.Completion)],
            'notes': [{'id': x.id, 'body': x.body, 'status': x.status, 'created_at': x.created_at} for x in own(m.Note, 'author_id')],
            'quiet_sessions': [{'started_at': x.started_at, 'last_seen_at': x.last_seen_at, 'ended_at': x.ended_at} for x in own(m.QuietSession)],
            'blocked': blocks(u, db)}
@r.delete('/me', status_code=204, dependencies=[rl('delete', 5, 60)])
def delete_me(b: DeleteIn, resp: Response, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify(u.password_hash, b.password): raise HTTPException(403, 'Password is incorrect.')
    pids = db.scalars(select(m.Post.id).where(m.Post.author_id == u.id)).all()
    rids = db.scalars(select(m.Reply.id).where(or_(m.Reply.author_id == u.id, m.Reply.post_id.in_(pids)))).all()
    drop_refs(db, pids, rids); nids = db.scalars(select(m.Note.id).where(m.Note.author_id == u.id)).all(); db.execute(delete(m.Report).where(m.Report.target_type == 'note', m.Report.target_id.in_(nids))); db.execute(delete(m.User).where(m.User.id == u.id)); db.commit()  # FK cascades remove sessions, journal, check-ins, posts, replies, saves, blocks, completions
    resp.delete_cookie(COOKIE, path='/')
