from datetime import datetime, timezone
from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
def now() -> datetime: return datetime.now(timezone.utc)
class Base(DeclarativeBase): pass
def owner(col='users.id', **k): return mapped_column(ForeignKey(col, ondelete='CASCADE'), index=True, **k)
TS = lambda **k: mapped_column(DateTime(timezone=True), default=now, **k)
class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    pseudonym: Mapped[str] = mapped_column(String(24), unique=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(16), default='active')
    low_energy: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str] = mapped_column(String(12), default='user', server_default='user')  # 'user' | 'moderator'; set only via the server CLI
    prefs: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = TS()
class UserSession(Base):
    __tablename__ = 'sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = owner()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
class CheckIn(Base):
    __tablename__ = 'check_ins'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = owner()
    emotion: Mapped[str] = mapped_column(String(16))
    note: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = TS()
class JournalEntry(Base):  # kept apart from all community tables; never joined into public queries
    __tablename__ = 'journal_entries'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = owner()
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = TS()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
class Post(Base):
    __tablename__ = 'posts'
    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = owner()
    category: Mapped[str] = mapped_column(String(40), index=True)
    body: Mapped[str] = mapped_column(String(600))
    status: Mapped[str] = mapped_column(String(16), default='active')
    created_at: Mapped[datetime] = TS(index=True)
    author: Mapped[User] = relationship()
class Reply(Base):
    __tablename__ = 'replies'
    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = owner('posts.id')
    author_id: Mapped[int] = owner()
    body: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(16), default='active')
    created_at: Mapped[datetime] = TS()
    author: Mapped[User] = relationship()
class Reaction(Base):  # "Me too" — never counted publicly
    __tablename__ = 'reactions'
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey('posts.id', ondelete='CASCADE'), primary_key=True)
    created_at: Mapped[datetime] = TS()
class Saved(Base):
    __tablename__ = 'saved_items'
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    item_type: Mapped[str] = mapped_column(String(12), primary_key=True)
    item_id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = TS()
class Activity(Base):
    __tablename__ = 'activities'
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String(400))
    duration_minutes: Mapped[int]
    energy_level: Mapped[str] = mapped_column(String(8))
    social_type: Mapped[str] = mapped_column(String(8))
    category: Mapped[str] = mapped_column(String(40), index=True)
class Completion(Base):
    __tablename__ = 'activity_completions'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = owner()
    activity_id: Mapped[int] = owner('activities.id')
    reflection: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = TS()
class Report(Base):  # reporter identity is dropped (SET NULL) if the reporter deletes their account
    __tablename__ = 'reports'
    __table_args__ = (UniqueConstraint('reporter_id', 'target_type', 'target_id'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), index=True)
    target_type: Mapped[str] = mapped_column(String(8))
    target_id: Mapped[int]
    reason: Mapped[str] = mapped_column(String(16))
    details: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(12), default='open')  # open | reviewed | dismissed | actioned
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = TS()
class Block(Base):
    __tablename__ = 'blocks'
    blocker_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    blocked_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    created_at: Mapped[datetime] = TS()
class ModerationLog(Base):  # append-only audit trail; survives deletion of the moderator's account (pseudonym is kept as a snapshot)
    __tablename__ = 'moderation_log'
    id: Mapped[int] = mapped_column(primary_key=True)
    moderator_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), index=True)
    moderator: Mapped[str] = mapped_column(String(24))
    action: Mapped[str] = mapped_column(String(24))
    report_id: Mapped[int | None]
    target_type: Mapped[str | None] = mapped_column(String(8))
    target_id: Mapped[int | None]
    note: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = TS(index=True)

class QuietSession(Base):  # presence only: no content, no identity is ever returned to other users
    __tablename__ = 'quiet_sessions'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = owner()
    started_at: Mapped[datetime] = TS()
    last_seen_at: Mapped[datetime] = TS(index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
class Note(Base):  # anonymous: readers and moderators never see the author; must be approved before anyone else can read it
    __tablename__ = 'notes'
    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = owner()
    body: Mapped[str] = mapped_column(String(280))
    status: Mapped[str] = mapped_column(String(12), default='pending', index=True)  # pending | approved | rejected | removed
    created_at: Mapped[datetime] = TS(index=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    author: Mapped[User] = relationship(foreign_keys='Note.author_id')  # two FKs to users, so be explicit
