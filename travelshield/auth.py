"""Platform authentication (separate from the synthetic target's agency roles)."""
import base64, hashlib, hmac, json, os, secrets, time

ROLES = ["viewer", "developer", "analyst", "admin"]  # ascending privilege
SESSIONS, FAILS = {}, {}
DEMO_USERS = {"admin": ("Admin#2026demo", "admin"), "analyst": ("Analyst#2026demo", "analyst"),
              "dev": ("Dev#2026demo", "developer"), "viewer": ("Viewer#2026demo", "viewer")}
SECRET_KEY = os.environ.get("TRAVELSHIELD_SECRET", "ts_sec_dev_2026_super_key_tbo_platform").encode()


def hash_pw(pw, salt=None):
    salt = salt or os.urandom(16)
    return salt.hex() + ":" + hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1).hex()


def check_pw(pw, stored):
    salt, h = stored.split(":")
    return hmac.compare_digest(hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1).hex(), h)


def seed_users(db):
    for u, (pw, role) in DEMO_USERS.items():
        if not db.execute("SELECT 1 FROM users WHERE username=?", (u,)).fetchone():
            db.execute("INSERT INTO users VALUES(?,?,?)", (u, hash_pw(pw), role))
    db.commit()


def _create_token(username, role):
    payload = json.dumps({"username": username, "role": role, "exp": int(time.time() + 8 * 3600)}).encode()
    b64_payload = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    sig = hmac.new(SECRET_KEY, b64_payload.encode(), hashlib.sha256).hexdigest()
    return f"{b64_payload}.{sig}"


def login(db, username, password):
    f = FAILS.get(username, (0, 0))
    if f[0] >= 5 and time.time() < f[1]:
        return None, "locked"
    row = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    if not row or not check_pw(password, row["pw_hash"]):
        FAILS[username] = (f[0] + 1, time.time() + 60)
        return None, "invalid"
    FAILS.pop(username, None)
    tok = _create_token(username, row["role"])
    SESSIONS[tok] = dict(username=username, role=row["role"], exp=time.time() + 8 * 3600)
    return tok, None


def session(token):
    if not token:
        return None
    # 1. Stateless HMAC verification across serverless lambdas
    try:
        if "." in token:
            b64_payload, sig = token.split(".", 1)
            expected_sig = hmac.new(SECRET_KEY, b64_payload.encode(), hashlib.sha256).hexdigest()
            if hmac.compare_digest(sig, expected_sig):
                padded = b64_payload + "=" * ((4 - len(b64_payload) % 4) % 4)
                data = json.loads(base64.urlsafe_b64decode(padded).decode())
                if data.get("exp", 0) >= time.time():
                    return data
    except Exception:
        pass

    # 2. In-memory session fallback
    s = SESSIONS.get(token)
    if not s or s["exp"] < time.time():
        SESSIONS.pop(token, None)
        return None
    return s


def allows(role, minimum):
    return ROLES.index(role) >= ROLES.index(minimum)
