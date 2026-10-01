"""Moderator-only review queue. Authorization is enforced here on the server (role read from the database on every request)."""
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from . import models as m
from .api import In, current_user
from .db import get_db

def moderator(u: m.User = Depends(current_user)) -> m.User:
    if u.role != 'moderator': raise HTTPException(403, 'Moderator access required')
    return u
mod = APIRouter(prefix='/api/mod', dependencies=[Depends(moderator)])
class ReviewIn(In): action: Literal['reviewed', 'dismiss', 'remove_content']; note: str | None = Field(None, max_length=500)
class TargetOut(BaseModel): author: str | None; category: str | None; body: str | None; content_status: str
class ModReportOut(BaseModel): id: int; target_type: str; target_id: int; reason: str; details: str | None; status: str; created_at: datetime; reviewed_at: datetime | None; reviewed_by: str | None; target: TargetOut  # never includes who reported
class ModReportPage(BaseModel): items: list[ModReportOut]; has_more: bool
class LogOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int; moderator: str; action: str; report_id: int | None; target_type: str | None; target_id: int | None; note: str | None; created_at: datetime

MODEL = {'post': m.Post, 'reply': m.Reply, 'note': m.Note}
def out(db: Session, r: m.Report) -> ModReportOut:
    t = db.get(MODEL[r.target_type], r.target_id); by = db.get(m.User, r.reviewed_by) if r.reviewed_by else None
    tgt = TargetOut(author=None if r.target_type == 'note' else t.author.pseudonym, category=getattr(t, 'category', None), body=t.body, content_status=t.status) if t else TargetOut(author=None, category=None, body=None, content_status='gone')
    return ModReportOut(id=r.id, target_type=r.target_type, target_id=r.target_id, reason=r.reason, details=r.details, status=r.status, created_at=r.created_at, reviewed_at=r.reviewed_at, reviewed_by=by.pseudonym if by else None, target=tgt)

@mod.get('/reports', response_model=ModReportPage)
def queue(status: Literal['open', 'reviewed', 'dismissed', 'actioned', 'all'] = 'open', page: int = Query(1, ge=1), per: int = Query(20, ge=1, le=50), db: Session = Depends(get_db)):
    q = select(m.Report)
    if status != 'all': q = q.where(m.Report.status == status)
    q = q.order_by(m.Report.created_at, m.Report.id) if status == 'open' else q.order_by(m.Report.created_at.desc(), m.Report.id.desc())  # open queue is oldest-first
    rows = db.scalars(q.offset((page - 1) * per).limit(per + 1)).all(); return ModReportPage(items=[out(db, r) for r in rows[:per]], has_more=len(rows) > per)

@mod.post('/reports/{id}/review', response_model=ModReportOut)
def review(id: int, b: ReviewIn, who: m.User = Depends(moderator), db: Session = Depends(get_db)):
    rp = db.get(m.Report, id)
    if not rp: raise HTTPException(404, 'Not found')
    if rp.status != 'open': raise HTTPException(409, 'This report was already handled.')
    now = datetime.now(timezone.utc); note = (b.note or '').strip() or None; handled = [rp]
    if b.action == 'remove_content':
        if t := db.get(MODEL[rp.target_type], rp.target_id): t.status = 'removed'  # hidden from every user by the existing visibility filters
        handled += db.scalars(select(m.Report).where(m.Report.target_type == rp.target_type, m.Report.target_id == rp.target_id, m.Report.status == 'open', m.Report.id != rp.id)).all()
    for r in handled:
        r.status = {'reviewed': 'reviewed', 'dismiss': 'dismissed', 'remove_content': 'actioned'}[b.action]; r.reviewed_by = who.id; r.reviewed_at = now
        db.add(m.ModerationLog(moderator_id=who.id, moderator=who.pseudonym, action=b.action, report_id=r.id, target_type=r.target_type, target_id=r.target_id, note=note))
    db.commit(); return out(db, rp)

@mod.get('/log', response_model=list[LogOut])
def audit_log(db: Session = Depends(get_db)): return db.scalars(select(m.ModerationLog).order_by(m.ModerationLog.id.desc()).limit(100)).all()

class NoteReview(In): action: Literal['approve', 'reject']; note: str | None = Field(None, max_length=500)
class PendingNote(BaseModel): id: int; body: str; created_at: datetime  # no author, by design
@mod.get('/notes', response_model=list[PendingNote])
def pending_notes(db: Session = Depends(get_db)): return [PendingNote(id=n.id, body=n.body, created_at=n.created_at) for n in db.scalars(select(m.Note).where(m.Note.status == 'pending').order_by(m.Note.created_at, m.Note.id).limit(50))]
@mod.post('/notes/{id}/review')
def review_note(id: int, b: NoteReview, who: m.User = Depends(moderator), db: Session = Depends(get_db)):
    n = db.get(m.Note, id)
    if not n: raise HTTPException(404, 'Not found')
    if n.status != 'pending': raise HTTPException(409, 'This note was already reviewed.')
    n.status = 'approved' if b.action == 'approve' else 'rejected'; n.reviewed_by = who.id; n.reviewed_at = datetime.now(timezone.utc)
    db.add(m.ModerationLog(moderator_id=who.id, moderator=who.pseudonym, action='note_' + b.action, target_type='note', target_id=n.id, note=(b.note or '').strip() or None)); db.commit(); return {'status': n.status}
