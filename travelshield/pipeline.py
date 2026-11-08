"""Orchestrator: change detection -> discovery -> inventory -> context -> plan -> safety -> test -> verify -> triage -> report -> retest."""
import httpx, json, uuid
from synthetic_travel_app.app import create_app
from . import changes, lifecycle, planner, triage, reporting
from .business import workflow_of
from .db import now, log_agent, rows, get_settings
from .discovery import discover
from .checks import REGISTRY
from .safety import SafetyGuardian
from .verification import execute

ACTIVE = []        # live guardians, so an emergency stop reaches running scans
STATE = dict(running=False, paused=False, current_workflow_id=None)


class ScanBusy(Exception):
    pass


def make_guardian(db, version, secure, **kw):
    s = get_settings(db)
    kw.setdefault("max_rps", s["max_rps"]); kw.setdefault("max_requests", s["max_requests"])
    g = SafetyGuardian(db, s["allowed_hosts"], httpx.ASGITransport(app=create_app(version, secure)), **kw)
    ACTIVE.append(g)
    del ACTIVE[:-20]
    return g


def stop_all():
    for g in ACTIVE:
        g.emergency_stop()
    return len(ACTIVE)


def pause_all():
    STATE["paused"] = True
    for g in ACTIVE:
        g.paused = True
    return len(ACTIVE)


def resume_all():
    STATE["paused"] = False
    for g in ACTIVE:
        g.paused = False
    return len(ACTIVE)


async def probe(g, inventory):
    """Reachability for parameterless GET endpoints only (no side effects)."""
    out = {}
    for e in inventory:
        if e["method"] == "GET" and "{" not in e["path"] and e["path"] != "/flights/search":
            r = await g.request("inventory-agent", "reachability", "GET", e["path"])
            out[e["key"]] = r.status_code not in (404, 410)
    return out


async def _execute_items(db, g, items, inventory):
    found = []
    for p in items:
        test = REGISTRY[p["test_id"]]
        try:
            v = await execute(test, g)
        except Exception as exc:
            log_agent(db, "Safety Guardian Agent", p["test_id"], "blocked", str(exc))
            continue
        db.execute("UPDATE plans SET executed=1 WHERE endpoint=? AND test_id=?", (p["endpoint"], p["test_id"]))
        if v is None:
            log_agent(db, "Security Execution Agent", p["test_id"], "ok", f"no issue on {p['endpoint']}")
            continue
        log_agent(db, "Verification Agent", p["test_id"], "ok", f"{v['status']}: {v['reason']}")
        if v["status"] == "False Positive":
            continue
        wf = next((e["workflow"] for e in inventory if e["key"] == p["endpoint"]), workflow_of(p["endpoint"].split(" ", 1)[1]))
        fid, _ = triage.store(db, test, p["endpoint"], wf, v)
        found.append(fid)
    db.commit()
    return found


async def run_cycle(db, out_dir="reports", approve=True, window_days=None, trigger="manual", workflow_id=None):
    if STATE["running"]:
        raise ScanBusy("a scan is already running")
    STATE["running"] = True
    wfid = workflow_id or f"wf-{uuid.uuid4().hex[:8]}"
    STATE["current_workflow_id"] = wfid
    db.execute(
        "INSERT INTO workflows(id,trigger,status,stage,started,endpoints_tested,findings_found,blocked_ops,detail) VALUES(?,?,?,?,?,?,?,?,?)",
        (wfid, trigger, "running", "Stage 1: Discovery & Changes", now(), 0, 0, 0, f"Triggered via {trigger}")
    )
    db.commit()
    try:
        res = await _cycle(db, out_dir, approve, window_days or get_settings(db)["window_days"], wfid)
        res["workflow_id"] = wfid
        return res
    except Exception as exc:
        db.execute("UPDATE workflows SET status='failed', stage='Failed', completed=?, error=? WHERE id=?",
                   (now(), str(exc), wfid))
        db.commit()
        raise
    finally:
        STATE["running"] = False
        STATE["current_workflow_id"] = None


async def _cycle(db, out_dir, approve, window_days, wfid):
    def _stage(s, endpoints=0, findings=0):
        db.execute("UPDATE workflows SET stage=?, endpoints_tested=?, findings_found=? WHERE id=?",
                   (s, endpoints, findings, wfid))
        db.commit()

    _stage("Stage 1: Change Detection & Diff")
    g1, g2 = make_guardian(db, 1, False), make_guardian(db, 2, False)
    v1, v2 = await discover(g1), await discover(g2, db)
    d = changes.diff(v1, v2)
    db.execute("DELETE FROM changes")
    for kind in ("added", "removed", "modified"):
        for c in d[kind]:
            db.execute("INSERT INTO changes(ts,kind,endpoint,detail,impact) VALUES(?,?,?,?,?)",
                       (now(), kind, c["key"], "; ".join(c["changes"]), c["impact"]))
    log_agent(db, "Change Detection Agent", "diff v1 vs v2", "ok",
              f"{len(d['added'])} added, {len(d['modified'])} modified, {len(d['removed'])} removed")

    _stage("Stage 2: Discovery & Inventory Classification", len(v2), 0)
    reach = await probe(g2, v2)
    zombies, shadows = lifecycle.classify(v2, lifecycle.synthetic_traffic(), reach, window_days)
    log_agent(db, "Inventory Intelligence Agent", "zombie/shadow classification", "ok",
              f"{len(zombies)} zombie, {len(shadows)} shadow (window {window_days}d)")
    db.execute("""DELETE FROM lifecycle WHERE detail NOT LIKE '%"browser"%'""")
    for kind, items in (("zombie", zombies), ("shadow", shadows)):
        for x in items:
            db.execute("INSERT OR REPLACE INTO lifecycle VALUES(?,?,?,?,?,?)", (x["key"], kind, x["evidence"], x["action"],
                       x.get("confidence", "-"), json.dumps({k: v for k, v in x.items() if k not in ("key", "evidence", "action", "confidence")})))
    inventory = list(v2)
    for s in shadows:
        m, p = s["key"].split(" ", 1)
        inventory.append(dict(key=s["key"], method=m, path=p, params=[], auth=False, workflow=workflow_of(p), source="traffic"))
    zk, sk = {z["key"] for z in zombies}, {s["key"] for s in shadows}
    new_keys = {c["key"] for c in d["added"] + d["modified"]}
    for e in inventory:
        life = "zombie" if e["key"] in zk else "shadow" if e["key"] in sk else "new" if e["key"] in new_keys else "active"
        old = db.execute("SELECT first_seen FROM endpoints WHERE key=?", (e["key"],)).fetchone()
        db.execute("INSERT OR REPLACE INTO endpoints VALUES(?,?,?,?,?,?,?,?,?,?)",
                   (e["key"], e["method"], e["path"], json.dumps(e["params"]), int(e["auth"]), e["workflow"],
                    e["source"], life, old["first_seen"] if old else now(), now()))
    db.commit()
    log_agent(db, "Business Context Agent", "workflow mapping", "ok",
              f"{sum(e['workflow'] != 'unmapped' for e in inventory)}/{len(inventory)} endpoints mapped")

    _stage("Stage 3: Attack Planning", len(inventory), 0)
    plan = planner.plan(inventory, new_keys)
    db.execute("DELETE FROM plans")
    for p in plan:
        p["approval_state"] = "auto" if p["approval"] == "auto" else ("approved" if approve else "pending")
        db.execute("INSERT INTO plans(ts,endpoint,test_id,reason,priority,approval) VALUES(?,?,?,?,?,?)",
                   (now(), p["endpoint"], p["test_id"], p["reason"], p["priority"], p["approval_state"]))
    db.commit()
    log_agent(db, "Attack Planning Agent", "plan", "ok",
              f"{len(plan)} test cases, {sum(p['approval_state'] == 'pending' for p in plan)} awaiting approval")

    _stage("Stage 4 & 5: Safety Guardian Validation & Security Execution", len(inventory), 0)
    found = await _execute_items(db, g2, [p for p in plan if p["approval_state"] != "pending"], inventory)
    log_agent(db, "Triage Agent", "risk scoring", "ok", f"{len(found)} findings stored/correlated")

    _stage("Stage 6 & 7: Verification & Business Risk Scoring", len(inventory), len(found))

    _stage("Stage 8: Report Generation", len(inventory), len(found))
    reporting.export(db, out_dir)
    log_agent(db, "Reporting Agent", "export", "ok", f"reports written to {out_dir}")
    pending = sum(p["approval_state"] == "pending" for p in plan)
    db.execute("INSERT INTO scans(ts,kind,status,requests,findings) VALUES(?,?,?,?,?)",
               (now(), "full" if approve else "plan-only", "stopped" if g2.killed else "completed", g2.count, len(found)))
    
    # Mark workflow as completed
    blocked_count = db.execute("SELECT COUNT(*) FROM audit WHERE decision='blocked'").fetchone()[0]
    db.execute(
        "UPDATE workflows SET status=?, stage=?, completed=?, endpoints_tested=?, findings_found=?, blocked_ops=? WHERE id=?",
        ("completed", "Completed", now(), len(inventory), len(found), blocked_count, wfid)
    )
    db.commit()
    return dict(changes=d, zombies=zombies, shadows=shadows, plan=plan, findings=found, requests=g2.count, pending=pending)


async def run_pending(db):
    """Human approval path: execute plan rows that were left pending."""
    items = rows(db, "SELECT endpoint,test_id FROM plans WHERE approval='pending' AND executed=0")
    inv = [dict(key=e["key"], workflow=e["workflow"]) for e in rows(db, "SELECT * FROM endpoints")]
    g = make_guardian(db, 2, False)
    found = await _execute_items(db, g, items, inv)
    db.execute("UPDATE plans SET approval='approved' WHERE approval='pending'")
    db.execute("INSERT INTO scans(ts,kind,status,requests,findings) VALUES(?,?,?,?,?)",
               (now(), "approved-batch", "completed", g.count, len(found)))
    db.commit()
    return found


async def retest(db, finding_id):
    """Retest against the fixed synthetic target; resolve only if the original attack no longer reproduces."""
    f = rows(db, "SELECT * FROM findings WHERE id=?", finding_id)[0]
    v = await execute(REGISTRY[f["test_id"]], make_guardian(db, 2, True))
    reproduced = v is not None
    final = "Reopened" if reproduced else "Resolved"
    db.execute("UPDATE findings SET status=? WHERE id=?", (final, finding_id))
    db.execute("INSERT INTO retests(finding_id,ts,reproduced,final_status) VALUES(?,?,?,?)", (finding_id, now(), int(reproduced), final))
    db.execute("INSERT INTO evidence(finding_id,kind,payload,ts) VALUES(?,?,?,?)",
               (finding_id, "retest", json.dumps(dict(expected=REGISTRY[f["test_id"]].expected,
                                                      actual="still reproducible" if reproduced else "no longer reproducible")), now()))
    db.commit()
    log_agent(db, "Retesting Agent", finding_id, "ok", final)
    return final


async def retest_all(db):
    return {r["id"]: await retest(db, r["id"]) for r in rows(db, "SELECT id FROM findings WHERE status IN ('Verified','Reopened')")}


async def browser_discovery(db):
    """Playwright crawl of the synthetic UI; routes referenced in JS but absent from the documented inventory become shadow candidates."""
    import asyncio
    from . import browser_discovery as bd
    g = make_guardian(db, 2, False)
    documented = {e["path"] for e in await discover(g)}
    import re

    def tmpl(path):
        return next((d for d in documented if re.fullmatch(re.sub(r"\{[^/]+\}", "[^/]+", d), path)), None)

    def work():
        with bd.serve_target(2, False) as base:
            return bd.crawl(db, base)
    res = await asyncio.to_thread(work)
    new = [r for r in res["routes"] if not tmpl(r)]
    for r in new:
        key = "GET " + r
        old = db.execute("SELECT evidence FROM lifecycle WHERE key=?", (key,)).fetchone()
        ev = "referenced in frontend JavaScript (/static/app.js) but absent from documented inventory"
        db.execute("INSERT OR REPLACE INTO lifecycle VALUES(?,?,?,?,?,?)",
                   (key, "shadow", (old["evidence"] + "; " if old else "") + ev, "assign owner; document or remove", "high",
                    json.dumps({"source": "browser"})))
        if not db.execute("SELECT 1 FROM endpoints WHERE key=?", (key,)).fetchone():
            db.execute("INSERT INTO endpoints VALUES(?,?,?,?,?,?,?,?,?,?)", (key, "GET", r, "[]", 0, workflow_of(r), "browser", "shadow", now(), now()))
    db.commit()
    log_agent(db, "Discovery Agent", "browser crawl", "ok", f"{len(res['pages'])} pages, {len(res['routes'])} JS routes, {len(new)} undocumented")
    return dict(res, undocumented=new)


async def scheduled_tick(db, now_ts=None):
    """Run a cycle if scan_interval_minutes > 0 and the last scan is older than the interval. Returns True if a scan ran."""
    import datetime as dt
    interval = get_settings(db).get("scan_interval_minutes", 0)
    if not interval or STATE["running"]:
        return False
    last = db.execute("SELECT ts FROM scans ORDER BY id DESC LIMIT 1").fetchone()
    t = now_ts or dt.datetime.now(dt.timezone.utc)
    if last and (t - dt.datetime.fromisoformat(last["ts"])).total_seconds() < interval * 60:
        return False
    await run_cycle(db, "reports", approve=False)  # scheduled scans never auto-approve state-changing tests
    return True
