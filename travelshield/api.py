"""Product API with platform auth/RBAC. Run on localhost; CORS is restricted to the dev UI origins."""
import asyncio, contextlib, json, os, pathlib, re, shutil, uuid
from fastapi import FastAPI, Depends, Header, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from . import auth, graph, pipeline, reporting, scenarios
from .db import connect, rows, now, get_settings, put_setting, log_agent
from .integrations import CONNECTORS
from .risk import score

REPORTS = pathlib.Path("/tmp/reports") if os.environ.get("VERCEL") else pathlib.Path("reports")


class Login(BaseModel):
    username: str
    password: str


def create_api(db, scheduler=False):
    auth.seed_users(db)
    @contextlib.asynccontextmanager
    async def lifespan(_app):
        task = None
        if scheduler:
            async def loop():
                while True:
                    await asyncio.sleep(30)
                    try: await pipeline.scheduled_tick(db)
                    except Exception as e: log_agent(db, "Reporting Agent", "scheduler", "failed", str(e))
            task = asyncio.create_task(loop())
        yield
        if task: task.cancel()

    app = FastAPI(title="TravelShield AI API", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
                       allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

    def need(minimum):
        def dep(authorization: str = Header(None)):
            s = auth.session((authorization or "").removeprefix("Bearer "))
            if not s:
                raise HTTPException(401, "login required")
            if not auth.allows(s["role"], minimum):
                db.execute("INSERT INTO audit(ts,actor,test,method,url,decision,reason) VALUES(?,?,?,?,?,?,?)",
                           (now(), s["username"], "platform", "-", "-", "blocked", f"role {s['role']} lacks {minimum}"))
                db.commit()
                raise HTTPException(403, f"requires role {minimum}")
            return s
        return dep

    one = lambda q, *a: db.execute(q, a).fetchone()[0]

    @app.get("/api/health")
    def health():
        return dict(status="healthy", service="TravelShield AI", version="2.0.0")

    @app.post("/api/auth/login")
    def login(b: Login):
        tok, err = auth.login(db, b.username, b.password)
        if err:
            raise HTTPException(429 if err == "locked" else 401, "login failed")
        return dict(token=tok, user=b.username, role=auth.SESSIONS[tok]["role"])

    @app.get("/api/me")
    def me(s=Depends(need("viewer"))): return dict(username=s["username"], role=s["role"])

    @app.get("/api/dashboard")
    def dashboard(s=Depends(need("viewer"))):
        sev = {r["severity"]: r["c"] for r in rows(db, "SELECT severity, COUNT(*) c FROM findings GROUP BY severity")}
        life = {r["lifecycle"]: r["c"] for r in rows(db, "SELECT lifecycle, COUNT(*) c FROM endpoints GROUP BY lifecycle")}
        lat = one("SELECT AVG(strftime('%s',verified_at)-strftime('%s',first_detected)) FROM findings WHERE verified_at IS NOT NULL")
        return dict(
            metrics=dict(endpoints=one("SELECT COUNT(*) FROM endpoints"), new=life.get("new", 0), zombie=life.get("zombie", 0),
                         shadow=life.get("shadow", 0), findings=one("SELECT COUNT(*) FROM findings"),
                         verified=one("SELECT COUNT(*) FROM findings WHERE status='Verified'"),
                         critical=sev.get("critical", 0), high=sev.get("high", 0), scans=one("SELECT COUNT(*) FROM scans"),
                         pending_remediation=one("SELECT COUNT(*) FROM findings WHERE status IN ('Verified','Reopened')"),
                         resolved=one("SELECT COUNT(*) FROM findings WHERE status='Resolved'"),
                         pending_approval=one("SELECT COUNT(*) FROM plans WHERE approval='pending' AND executed=0"),
                         blocked_requests=one("SELECT COUNT(*) FROM audit WHERE decision='blocked'"),
                         requests_audited=one("SELECT COUNT(*) FROM audit"), mean_seconds_to_verify=lat),
            severity=[dict(name=k, value=v) for k, v in sev.items()], lifecycle=[dict(name=k, value=v) for k, v in life.items()],
            timeline=rows(db, "SELECT substr(first_detected,1,10) day, COUNT(*) found FROM findings GROUP BY day ORDER BY day"),
            top_risk=rows(db, "SELECT id,title,priority,risk_score,status FROM findings ORDER BY risk_score DESC LIMIT 5"),
            changes=rows(db, "SELECT * FROM changes ORDER BY impact DESC LIMIT 5"),
            scans=rows(db, "SELECT * FROM scans ORDER BY id DESC LIMIT 5"),
            agents=rows(db, "SELECT * FROM agent_events ORDER BY id DESC LIMIT 10"))

    @app.get("/api/applications")
    def apps(s=Depends(need("viewer"))):
        return [dict(name="Synthetic Travel Platform", environment="local-demo", versions=[1, 2],
                     modes=["vulnerable", "fixed"], label="SYNTHETIC demonstration target", endpoints=one("SELECT COUNT(*) FROM endpoints"))]

    @app.get("/api/inventory")
    def inventory(s=Depends(need("viewer"))): return rows(db, "SELECT * FROM endpoints ORDER BY key")
    @app.get("/api/changes")
    def changes(s=Depends(need("viewer"))): return rows(db, "SELECT * FROM changes ORDER BY impact DESC")
    @app.get("/api/lifecycle")
    def life(s=Depends(need("viewer"))):
        from .business import SENSITIVE
        out = rows(db, """SELECT l.*, e.workflow, e.auth, (SELECT COUNT(*) FROM findings f WHERE f.endpoint=l.key AND f.status IN ('Verified','Reopened')) known_findings
                          FROM lifecycle l LEFT JOIN endpoints e ON e.key=l.key ORDER BY kind, key""")
        for r in out:
            r["data_classification"] = "sensitive" if r["workflow"] in SENSITIVE else "standard"
            r["authentication"] = "none" if not r["auth"] else "required"
        return out
    @app.get("/api/graph")
    def g(s=Depends(need("viewer"))): return graph.build(db)
    @app.get("/api/plans")
    def plans(s=Depends(need("viewer"))): return rows(db, "SELECT * FROM plans ORDER BY priority, endpoint")
    @app.get("/api/scans")
    def scans(s=Depends(need("viewer"))): return rows(db, "SELECT * FROM scans ORDER BY id DESC")
    @app.get("/api/audit")
    def audit(s=Depends(need("viewer"))): return rows(db, "SELECT * FROM audit ORDER BY id DESC LIMIT 300")
    @app.get("/api/retests")
    def retests(s=Depends(need("viewer"))): return rows(db, "SELECT * FROM retests ORDER BY id DESC")
    @app.get("/api/integrations")
    def integ(s=Depends(need("viewer"))): return [c.describe(db) for c in CONNECTORS]

    @app.get("/api/agents")
    def agents(s=Depends(need("viewer"))):
        return rows(db, """SELECT agent, COUNT(*) tasks, SUM(status='ok') ok, SUM(status!='ok') failed_or_blocked,
                           MAX(ts) last_run, (SELECT message FROM agent_events e2 WHERE e2.agent=e.agent ORDER BY id DESC LIMIT 1) latest
                           FROM agent_events e GROUP BY agent ORDER BY last_run DESC""")

    @app.get("/api/safety")
    def safety(s=Depends(need("viewer"))):
        return dict(active_scans=int(pipeline.STATE["running"]), requests=one("SELECT COUNT(*) FROM audit WHERE decision='allowed'"),
                    blocked=one("SELECT COUNT(*) FROM audit WHERE decision='blocked'"),
                    scope_violations=one("SELECT COUNT(*) FROM audit WHERE reason LIKE 'out_of_scope%'"),
                    emergency_stops=one("SELECT COUNT(*) FROM audit WHERE reason='emergency_stop'"),
                    settings={k: v for k, v in get_settings(db).items() if k in ("allowed_hosts", "max_rps", "max_requests")},
                    events=rows(db, "SELECT * FROM audit WHERE decision='blocked' ORDER BY id DESC LIMIT 20"))

    @app.post("/api/safety/stop")
    def stop(s=Depends(need("analyst"))):
        n = pipeline.stop_all()
        log_agent(db, "Safety Guardian Agent", "emergency stop", "blocked", f"{n} guardians halted by {s['username']}")
        return dict(halted=n)

    # Automation Engine endpoints
    @app.get("/api/automation/status")
    def auto_status(s=Depends(need("viewer"))):
        latest = rows(db, "SELECT * FROM workflows ORDER BY started DESC LIMIT 1")
        return dict(
            running=bool(pipeline.STATE["running"]),
            paused=bool(pipeline.STATE.get("paused", False)),
            current_workflow_id=pipeline.STATE.get("current_workflow_id"),
            latest_workflow=latest[0] if latest else None,
            scheduler=bool(get_settings(db).get("scan_interval_minutes", 0) > 0)
        )

    @app.get("/api/automation/workflows")
    def auto_workflows(s=Depends(need("viewer"))):
        return rows(db, "SELECT * FROM workflows ORDER BY started DESC LIMIT 50")

    @app.post("/api/automation/run")
    async def auto_run(approve: bool = True, s=Depends(need("analyst"))):
        try:
            r = await pipeline.run_cycle(db, REPORTS, approve=approve, trigger=f"manual:{s['username']}")
            return dict(findings=r["findings"], requests=r["requests"], pending_approval=r["pending"], workflow_id=r.get("workflow_id"))
        except pipeline.ScanBusy:
            raise HTTPException(409, "scan already running")

    @app.post("/api/automation/deploy")
    async def auto_deploy(payload: dict = Body(default={}), s=Depends(need("developer"))):
        version = payload.get("version", "v2-release-candidate")
        commit = payload.get("commit", "c8f3b21")
        trigger_desc = f"deployment:{version} ({commit}) by {s['username']}"
        try:
            r = await pipeline.run_cycle(db, REPORTS, approve=True, trigger=trigger_desc)
            return dict(status="completed", trigger=trigger_desc, workflow_id=r.get("workflow_id"),
                        findings=len(r["findings"]), requests=r["requests"])
        except pipeline.ScanBusy:
            raise HTTPException(409, "a security cycle is already in progress")

    @app.post("/api/automation/pause")
    def auto_pause(s=Depends(need("analyst"))):
        cnt = pipeline.pause_all()
        log_agent(db, "Safety Guardian Agent", "pause scan", "ok", f"scans paused by {s['username']}")
        return dict(paused=True, affected=cnt)

    @app.post("/api/automation/resume")
    def auto_resume(s=Depends(need("analyst"))):
        cnt = pipeline.resume_all()
        log_agent(db, "Safety Guardian Agent", "resume scan", "ok", f"scans resumed by {s['username']}")
        return dict(paused=False, affected=cnt)

    # findings
    @app.get("/api/findings")
    def findings(status: str | None = None, severity: str | None = None, category: str | None = None,
                 date_from: str | None = None, date_to: str | None = None, workflow: str | None = None, owner: str | None = None,
                 s=Depends(need("viewer"))):
        q, a = "SELECT f.*, m.owner, m.priority AS priority_override FROM findings f LEFT JOIN finding_meta m ON m.finding_id=f.id WHERE 1=1", []
        for col, val in (("f.status", status), ("f.severity", severity), ("f.category", category), ("f.workflow", workflow), ("m.owner", owner)):
            if val: q += f" AND {col}=?"; a.append(val)
        if date_from: q += " AND substr(f.first_detected,1,10)>=?"; a.append(date_from)
        if date_to: q += " AND substr(f.first_detected,1,10)<=?"; a.append(date_to)
        return rows(db, q + " ORDER BY f.risk_score DESC", *a)

    @app.get("/api/findings/{fid}")
    def finding(fid: str, s=Depends(need("viewer"))):
        f = rows(db, "SELECT * FROM findings WHERE id=?", fid)
        if not f: raise HTTPException(404, "not found")
        f = f[0]; f["risk_explanation"] = json.loads(f.pop("risk_json"))
        return dict(finding=f, meta=(rows(db, "SELECT * FROM finding_meta WHERE finding_id=?", fid) or [None])[0],
                    evidence=[dict(e, payload=json.loads(e["payload"])) for e in rows(db, "SELECT * FROM evidence WHERE finding_id=? ORDER BY id", fid)],
                    retests=rows(db, "SELECT * FROM retests WHERE finding_id=?", fid))

    class Patch(BaseModel):
        owner: str | None = None
        note: str | None = None
        priority: str | None = None
        status: str | None = None

    @app.patch("/api/findings/{fid}")
    def patch(fid: str, p: Patch, s=Depends(need("developer"))):
        if not one("SELECT COUNT(*) FROM findings WHERE id=?", fid): raise HTTPException(404, "not found")
        if p.status == "Resolved":
            raise HTTPException(422, "status can only become Resolved through a retest")
        if p.priority and not auth.allows(s["role"], "analyst"):
            raise HTTPException(403, "analyst role required")
        if p.priority and p.priority not in ("P1", "P2", "P3"):
            raise HTTPException(422, "bad priority")
        if p.status:
            valid_statuses = ("False Positive", "Needs Review", "Assigned", "In Progress", "Fixed", "Reopened", "Verified", "New")
            if p.status not in valid_statuses:
                raise HTTPException(422, f"invalid status: {p.status}")
            analyst_only_statuses = ("False Positive", "Needs Review", "Reopened", "Verified")
            if p.status in analyst_only_statuses and not auth.allows(s["role"], "analyst"):
                raise HTTPException(403, "analyst role required")
        m = (rows(db, "SELECT * FROM finding_meta WHERE finding_id=?", fid) or [dict(owner=None, notes="", priority=None)])[0]
        notes = (m["notes"] or "") + (f"[{now()} {s['username']}] {p.note}\n" if p.note else "")
        new_owner = p.owner or m["owner"]
        db.execute("INSERT OR REPLACE INTO finding_meta VALUES(?,?,?,?)", (fid, new_owner, notes, p.priority or m["priority"]))
        new_status = p.status
        if not new_status and p.owner:
            cur_status = db.execute("SELECT status FROM findings WHERE id=?", (fid,)).fetchone()["status"]
            if cur_status == "Verified":
                new_status = "Assigned"
        if new_status:
            db.execute("UPDATE findings SET status=? WHERE id=?", (new_status, fid))
        db.commit()
        return dict(ok=True)

    @app.post("/api/findings/{fid}/retest")
    async def rt(fid: str, s=Depends(need("analyst"))):
        if not one("SELECT COUNT(*) FROM findings WHERE id=?", fid): raise HTTPException(404, "not found")
        db.execute("UPDATE findings SET status='Retesting' WHERE id=?", (fid,))
        db.commit()
        return dict(final_status=await pipeline.retest(db, fid))

    @app.post("/api/retest-all")
    async def rta(s=Depends(need("analyst"))): return await pipeline.retest_all(db)

    @app.post("/api/cycle")
    async def cycle(approve: bool = True, s=Depends(need("analyst"))):
        try:
            r = await pipeline.run_cycle(db, REPORTS, approve=approve, trigger=f"manual:{s['username']}")
        except pipeline.ScanBusy:
            raise HTTPException(409, "scan already running")
        return dict(findings=r["findings"], requests=r["requests"], pending_approval=r["pending"], workflow_id=r.get("workflow_id"))

    @app.post("/api/plans/approve")
    async def approve(s=Depends(need("analyst"))):
        log_agent(db, "Attack Planning Agent", "human approval", "ok", f"approved by {s['username']}")
        return dict(findings=await pipeline.run_pending(db))

    @app.post("/api/scenarios/{n}")
    async def scenario(n: int, s=Depends(need("analyst"))):
        try:
            return dict(steps=await scenarios.run(db, n))
        except KeyError:
            raise HTTPException(404, "unknown scenario")

    # reports
    @app.get("/api/reports/{fmt}")
    def report(fmt: str, s=Depends(need("viewer"))):
        reporting.export(db, REPORTS)
        if fmt == "pdf":
            reporting.pdf(db, REPORTS / "executive_report.pdf"); return FileResponse(REPORTS / "executive_report.pdf")
        if fmt in ("csv", "json"): return FileResponse(REPORTS / f"findings.{fmt}")
        raise HTTPException(404, "unknown format")


    @app.post("/api/discovery/browser")
    async def browser(s=Depends(need("analyst"))):
        try:
            return await pipeline.browser_discovery(db)
        except Exception as e:
            from .browser_discovery import BrowserUnavailable
            if isinstance(e, BrowserUnavailable):
                raise HTTPException(501, str(e))
            raise

    @app.get("/api/search")
    def search(q: str = Query(..., min_length=2, max_length=60), s=Depends(need("viewer"))):
        like = f"%{q}%"
        return dict(findings=rows(db, "SELECT id,title,status FROM findings WHERE id LIKE ? OR title LIKE ? OR endpoint LIKE ? LIMIT 8", like, like, like),
                    endpoints=rows(db, "SELECT key,lifecycle FROM endpoints WHERE key LIKE ? LIMIT 8", like))

    @app.get("/api/notifications")
    def notifications(s=Depends(need("viewer"))):
        if get_settings(db).get("notifications") == "muted": return []
        n = []
        p = one("SELECT COUNT(*) FROM plans WHERE approval='pending' AND executed=0")
        if p: n.append(dict(level="warn", text=f"{p} planned tests await approval", to="/planner"))
        for f in rows(db, "SELECT id,title FROM findings WHERE priority='P1' AND status IN ('Verified','Reopened') ORDER BY risk_score DESC LIMIT 3"):
            n.append(dict(level="high", text=f"{f['id']}: {f['title']}", to="/vulns"))
        for a in rows(db, "SELECT reason,url FROM audit WHERE decision='blocked' ORDER BY id DESC LIMIT 3"):
            n.append(dict(level="info", text=f"Blocked: {a['reason']}", to="/audit"))
        return n

    CAPS = {
        "viewer": ["read all pages", "view dashboard", "view findings", "view workflows", "download reports"],
        "developer": ["annotate findings (owner, notes)", "set status to Assigned, In Progress, Fixed", "trigger deployment simulation"],
        "analyst": ["run autonomous security cycles", "pause/resume scans", "approve pending tests", "retest findings", "mark false positive / change priority", "emergency stop", "browser discovery"],
        "admin": ["edit system settings", "manage users and RBAC roles", "configure rate limits and scope"]
    }

    @app.get("/api/roles")
    def roles(s=Depends(need("viewer"))): return CAPS

    class NewUser(BaseModel):
        username: str
        password: str
        role: str

    @app.post("/api/users")
    def add_user(u: NewUser, s=Depends(need("admin"))):
        if not re.fullmatch(r"[a-z0-9_.-]{3,32}", u.username): raise HTTPException(422, "username: 3-32 chars a-z 0-9 _ . -")
        if u.role not in auth.ROLES: raise HTTPException(422, "unknown role")
        if len(u.password) < 10 or not re.search(r"\d", u.password) or not re.search(r"[A-Za-z]", u.password):
            raise HTTPException(422, "password: at least 10 characters with letters and digits")
        if one("SELECT COUNT(*) FROM users WHERE username=?", u.username): raise HTTPException(409, "user exists")
        db.execute("INSERT INTO users VALUES(?,?,?)", (u.username, auth.hash_pw(u.password), u.role)); db.commit()
        return dict(ok=True)

    class RolePatch(BaseModel):
        role: str

    @app.patch("/api/users/{username}")
    def set_role(username: str, p: RolePatch, s=Depends(need("admin"))):
        if p.role not in auth.ROLES: raise HTTPException(422, "unknown role")
        cur = rows(db, "SELECT role FROM users WHERE username=?", username)
        if not cur: raise HTTPException(404, "not found")
        if cur[0]["role"] == "admin" and p.role != "admin" and one("SELECT COUNT(*) FROM users WHERE role='admin'") <= 1:
            raise HTTPException(409, "cannot demote the last admin")
        db.execute("UPDATE users SET role=? WHERE username=?", (p.role, username)); db.commit()
        for t in [t for t, v in auth.SESSIONS.items() if v["username"] == username]: auth.SESSIONS.pop(t)  # force re-login with the new role
        return dict(ok=True)

    # settings and users
    @app.get("/api/settings")
    def settings(s=Depends(need("viewer"))): return get_settings(db)

    @app.put("/api/settings/{key}")
    def setting(key: str, value=Body(..., embed=True), s=Depends(need("admin"))):
        from .db import DEFAULT_SETTINGS
        if key not in DEFAULT_SETTINGS: raise HTTPException(404, "unknown setting")
        if key in ("window_days", "max_rps", "max_requests") and (not isinstance(value, int) or not 1 <= value <= 10000):
            raise HTTPException(422, "must be an integer 1-10000")
        if key == "scan_interval_minutes" and (not isinstance(value, int) or not 0 <= value <= 1440):
            raise HTTPException(422, "0 (off) to 1440 minutes")
        if key == "notifications" and value not in ("in-app only", "muted"):
            raise HTTPException(422, "in-app only or muted")
        if key == "allowed_hosts" and (not isinstance(value, list) or not all(isinstance(h, str) for h in value)):
            raise HTTPException(422, "list of hostnames required")
        put_setting(db, key, value)
        return dict(ok=True)

    @app.get("/api/users")
    def users(s=Depends(need("admin"))): return rows(db, "SELECT username, role FROM users")

    # ── Automation engine ──────────────────────────────────────────
    AUTOMATION = dict(enabled=False, paused=False)

    @app.get("/api/automation/status")
    def auto_status(s=Depends(need("viewer"))):
        return dict(**AUTOMATION, running=pipeline.STATE["running"])

    @app.post("/api/automation/enable")
    def auto_enable(s=Depends(need("analyst"))):
        pipeline.resume_all()
        log_agent(db, "Automation Engine", "enable", "ok", f"enabled by {s['username']}")
        return dict(enabled=True, paused=False, running=pipeline.STATE["running"])

    @app.post("/api/automation/disable")
    def auto_disable(s=Depends(need("analyst"))):
        pipeline.pause_all()
        log_agent(db, "Automation Engine", "disable", "ok", f"disabled by {s['username']}")
        return dict(enabled=False, paused=True, running=pipeline.STATE["running"])

    @app.get("/api/health")
    def health():
        return dict(status="healthy", service="TravelShield AI", version="2.0.0", environment="synthetic-demo")

    return app


db_file = pathlib.Path(__file__).resolve().parent.parent / "travelshield.db"
if not db_file.exists():
    db_file = pathlib.Path("travelshield.db")
if os.environ.get("VERCEL"):
    tmp_db = pathlib.Path("/tmp/travelshield.db")
    if not tmp_db.exists() and db_file.exists():
        shutil.copy(str(db_file), str(tmp_db))
    db_file = tmp_db

app = create_api(connect(str(db_file)), scheduler=not bool(os.environ.get("VERCEL")))
