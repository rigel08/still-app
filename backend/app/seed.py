"""Activity catalogue (editorial content, not user content). Run: python -m app.seed"""
from sqlalchemy import func, select
from .models import Activity
A = [('Listen to one song without opening another app.', 'Music and memories', 2, 'Low', 'Solo'),
     ('Step outside and notice three things you usually overlook.', 'Getting outside', 5, 'Low', 'Solo'),
     ('Send a message to someone you miss. No pressure to start a long conversation.', 'Being around people', 3, 'Medium', 'Social'),
     ('Draw something badly on purpose.', 'Creative experiments', 10, 'Medium', 'Solo'),
     ("Visit a place nearby you've never explored.", 'Getting outside', 30, 'Medium', 'Solo'),
     ('Find a song from a year you remember clearly.', 'Music and memories', 5, 'Low', 'Solo'),
     ('Drink something warm and just look out of a window.', 'Low-energy activities', 5, 'Low', 'Solo'),
     ("Look up one thing you've always wondered about.", 'Learning something new', 10, 'Low', 'Solo'),
     ("Take three slow breaths. That's the whole thing.", '2-minute moments', 2, 'Low', 'Solo'),
     ('Sit somewhere with other people around, no need to talk.', 'Quiet activities', 20, 'Medium', 'Social')]
def seed(db) -> int:
    if db.scalar(select(func.count()).select_from(Activity)): return 0
    db.add_all(Activity(title=t, description=t, category=c, duration_minutes=d, energy_level=e, social_type=s) for t, c, d, e, s in A); db.commit(); return len(A)
if __name__ == '__main__':
    from .db import SessionLocal
    with SessionLocal() as s: print('seeded', seed(s))
