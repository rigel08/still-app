import hashlib, secrets
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
_ph = PasswordHasher()
DUMMY = _ph.hash('not-a-real-password')  # verified against for unknown emails, so timing doesn't reveal accounts
def hash_pw(p: str) -> str: return _ph.hash(p)
def verify(h: str, p: str) -> bool:
    try: return _ph.verify(h, p)
    except (VerificationError, InvalidHashError): return False
def new_token() -> str: return secrets.token_urlsafe(32)
def digest(t: str) -> str: return hashlib.sha256(t.encode()).hexdigest()  # only the hash of a session token is stored
