import sqlite3, datetime as dt, json

SCHEMA = """
CREATE TABLE IF NOT EXISTS endpoints(key TEXT PRIMARY KEY, method TEXT, path TEXT, params TEXT, auth INTEGER,
  workflow TEXT, source TEXT, lifecycle TEXT, first_seen TEXT, last_seen TEXT);
CREATE TABLE IF NOT EXISTS findings(id TEXT PRIMARY KEY, fingerprint TEXT UNIQUE, test_id TEXT, title TEXT,
  category TEXT, severity TEXT, status TEXT, endpoint TEXT, workflow TEXT, confidence REAL, risk_score REAL,
  priority TEXT, risk_json TEXT, remediation TEXT, first_detected TEXT, last_detected TEXT, verified_at TEXT);
CREATE TABLE IF NOT EXISTS evidence(id INTEGER PRIMARY KEY, finding_id TEXT, kind TEXT, payload TEXT, ts TEXT);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, ts TEXT, actor TEXT, test TEXT, method TEXT, url TEXT,
  decision TEXT, reason TEXT);
CREATE TABLE IF NOT EXISTS agent_events(id INTEGER PRIMARY KEY, ts TEXT, agent TEXT, task TEXT, status TEXT, message TEXT);
CREATE TABLE IF NOT EXISTS retests(id INTEGER PRIMARY KEY, finding_id TEXT, ts TEXT, reproduced INTEGER, final_status TEXT);
CREATE TABLE IF NOT EXISTS plans(id INTEGER PRIMARY KEY, ts TEXT, endpoint TEXT, test_id TEXT, reason TEXT,
  priority INTEGER, approval TEXT, executed INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS lifecycle(key TEXT PRIMARY KEY, kind TEXT, evidence TEXT, action TEXT, confidence TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY, pw_hash TEXT, role TEXT);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS scans(id INTEGER PRIMARY KEY, ts TEXT, kind TEXT, status TEXT, requests INTEGER, findings INTEGER);
CREATE TABLE IF NOT EXISTS finding_meta(finding_id TEXT PRIMARY KEY, owner TEXT, notes TEXT, priority TEXT);
CREATE TABLE IF NOT EXISTS changes(id INTEGER PRIMARY KEY, ts TEXT, kind TEXT, endpoint TEXT, detail TEXT, impact INTEGER);
CREATE TABLE IF NOT EXISTS workflows(id TEXT PRIMARY KEY, trigger TEXT, status TEXT, stage TEXT,
  started TEXT, completed TEXT, endpoints_tested INTEGER DEFAULT 0, findings_found INTEGER DEFAULT 0,
  blocked_ops INTEGER DEFAULT 0, error TEXT, detail TEXT);
"""


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def connect(path=":memory:"):
    c = sqlite3.connect(path, check_same_thread=False)
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA)
    return c


def log_agent(db, agent, task, status, message):
    db.execute("INSERT INTO agent_events(ts,agent,task,status,message) VALUES(?,?,?,?,?)",
               (now(), agent, task, status, message))
    db.commit()


def rows(db, sql, *a):
    return [dict(r) for r in db.execute(sql, a).fetchall()]


DEFAULT_SETTINGS = dict(
    window_days=90, max_rps=200, max_requests=600, allowed_hosts=["synthetic-travel.local"],
    approval_policy="state-changing tests require approval", audit_retention_days=365,
    risk_weights=dict(critical=9.0, high=7.5, medium=5.0, low=2.5), notifications="in-app only", scan_interval_minutes=0)


def get_settings(db):
    s = dict(DEFAULT_SETTINGS)
    for r in db.execute("SELECT key,value FROM settings"):
        s[r["key"]] = json.loads(r["value"])
    return s


def put_setting(db, key, value):
    db.execute("INSERT OR REPLACE INTO settings VALUES(?,?)", (key, json.dumps(value)))
    db.commit()
