"""Grant or revoke moderator access. Run on the server with DATABASE_URL set:

    python -m app.make_moderator user@example.com            # grant
    python -m app.make_moderator user@example.com --revoke   # revoke

The account must already exist (registered normally). There is deliberately no HTTP route that grants roles."""
import sys
from sqlalchemy import select
from . import models as m

def set_role(db, email: str, role: str) -> m.User:
    if role not in ('user', 'moderator'): raise ValueError('role')
    u = db.scalar(select(m.User).where(m.User.email == email.strip().lower()))
    if not u: raise LookupError(email)
    if u.role != role:
        u.role = role; db.add(m.ModerationLog(moderator_id=None, moderator='(server CLI)', action='grant_role' if role == 'moderator' else 'revoke_role', target_type='user', target_id=u.id)); db.commit()
    return u

def main(argv=None):
    a = sys.argv[1:] if argv is None else argv; emails = [x for x in a if not x.startswith('--')]
    if len(emails) != 1: raise SystemExit(__doc__)
    from .db import SessionLocal
    with SessionLocal() as db:
        try: u = set_role(db, emails[0], 'user' if '--revoke' in a else 'moderator')
        except LookupError: raise SystemExit('No account with that email. Register it through the app first.')
    print(f'{u.pseudonym} is now a {u.role}.')
if __name__ == '__main__': main()
