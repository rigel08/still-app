"""The Quiet Room (real, anonymous presence) and Notes From Strangers (anonymous, moderator-approved notes)."""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, distinct, func, select, update
from sqlalchemy.orm import Session
from . import models as m
from .api import In, current_user, rl
from .db import get_db
s = APIRouter(prefix='/api')
WINDOW = 90  # seconds without a heartbeat before someone no longer counts as present
def now() -> datetime: return datetime.now(timezone.utc)
def active(): return [m.QuietSession.ended_at.is_(None), m.QuietSession.last_seen_at >= now() - timedelta(seconds=WINDOW)]
class QuietOut(BaseModel): present: int; mine: bool; window_seconds: int = WINDOW  # a count only: never names, ids or durations of others
def status(db: Session, u: m.User) -> QuietOut:
    n = db.scalar(select(func.count(distinct(m.QuietSession.user_id))).where(*active()))
    return QuietOut(present=n, mine=db.scalar(select(m.QuietSession.id).where(m.QuietSession.user_id == u.id, *active()).limit(1)) is not None)
@s.get('/quiet', response_model=QuietOut)
def quiet(u: m.User = Depends(current_user), db: Session = Depends(get_db)): return status(db, u)
@s.post('/quiet/join', response_model=QuietOut, dependencies=[rl('qjoin', 20, 60)])
def join(u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(m.QuietSession).where(m.QuietSession.last_seen_at < now() - timedelta(days=7)))  # retention: presence records are not kept
    cur = db.scalar(select(m.QuietSession).where(m.QuietSession.user_id == u.id, *active()).limit(1))
    if cur: cur.last_seen_at = now()
    else: db.add(m.QuietSession(user_id=u.id, started_at=now(), last_seen_at=now()))
    db.commit(); return status(db, u)
@s.post('/quiet/heartbeat', response_model=QuietOut, dependencies=[rl('qhb', 120, 60)])
def heartbeat(u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(m.QuietSession).where(m.QuietSession.user_id == u.id, *active()).values(last_seen_at=now())); db.commit(); return status(db, u)
@s.post('/quiet/leave', response_model=QuietOut)
def leave(u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(m.QuietSession).where(m.QuietSession.user_id == u.id, m.QuietSession.ended_at.is_(None)).values(ended_at=now())); db.commit(); return status(db, u)

class NoteIn(In): body: str = Field(min_length=10, max_length=280)
class NoteMine(BaseModel): model_config = {'from_attributes': True}; id: int; body: str; status: str; created_at: datetime
class NoteRead(BaseModel): id: int; body: str  # the only thing a reader ever receives
@s.post('/notes', response_model=NoteMine, status_code=201, dependencies=[rl('note', 5, 3600)])
def add_note(b: NoteIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    n = m.Note(author_id=u.id, body=b.body.strip()); db.add(n); db.commit(); return n
@s.get('/notes/mine', response_model=list[NoteMine])
def my_notes(u: m.User = Depends(current_user), db: Session = Depends(get_db)): return db.scalars(select(m.Note).where(m.Note.author_id == u.id).order_by(m.Note.id.desc())).all()
@s.delete('/notes/{id}', status_code=204)
def del_note(id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    n = db.get(m.Note, id)
    if not n or n.author_id != u.id: raise HTTPException(404, 'Not found')
    db.execute(delete(m.Report).where(m.Report.target_type == 'note', m.Report.target_id == id)); db.delete(n); db.commit()
@s.get('/notes/next', response_model=NoteRead | None)
def next_note(u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(m.Note).where(m.Note.status == 'approved', m.Note.author_id != u.id, m.Note.id.not_in(select(m.Report.target_id).where(m.Report.reporter_id == u.id, m.Report.target_type == 'note')),
        m.Note.author_id.not_in(select(m.Block.blocked_id).where(m.Block.blocker_id == u.id))).order_by(func.random()).limit(1)
    n = db.scalar(q); return NoteRead(id=n.id, body=n.body) if n else None
