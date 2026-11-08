import pytest
from fastapi.testclient import TestClient
from travelshield.api import create_api
from travelshield.db import connect
from travelshield import pipeline, auth, scenarios
import asyncio


@pytest.fixture
def api(tmp_path, monkeypatch):
    import travelshield.api as m
    monkeypatch.setattr(m, "REPORTS", tmp_path)
    auth.FAILS.clear(); pipeline.STATE["running"] = False
    db = connect()
    return TestClient(create_api(db)), db


def tok(c, u, p):
    return {"Authorization": "Bearer " + c.post("/api/auth/login", json=dict(username=u, password=p)).json()["token"]}


def test_auth_required_and_bad_password(api):
    c, _ = api
    assert c.get("/api/dashboard").status_code == 401
    assert c.post("/api/auth/login", json=dict(username="admin", password="nope")).status_code == 401


def test_lockout_after_failures(api):
    c, _ = api
    for _ in range(5): c.post("/api/auth/login", json=dict(username="viewer", password="x"))
    assert c.post("/api/auth/login", json=dict(username="viewer", password="Viewer#2026demo")).status_code == 429


def test_rbac_and_dashboard_matches_db(api):
    c, db = api
    v, a, adm = tok(c, "viewer", "Viewer#2026demo"), tok(c, "analyst", "Analyst#2026demo"), tok(c, "admin", "Admin#2026demo")
    assert c.post("/api/cycle", headers=v).status_code == 403
    assert c.put("/api/settings/window_days", json=dict(value=30), headers=a).status_code == 403
    assert c.post("/api/cycle", headers=a).status_code == 200
    d = c.get("/api/dashboard", headers=v).json()["metrics"]
    assert d["findings"] == db.execute("SELECT COUNT(*) FROM findings").fetchone()[0] == 18
    assert d["zombie"] == 1 and d["shadow"] == 1 and d["blocked_requests"] >= 1  # the 403 above is audited
    assert c.put("/api/settings/window_days", json=dict(value=30), headers=adm).status_code == 200
    assert c.put("/api/settings/window_days", json=dict(value=-4), headers=adm).status_code == 422


def test_finding_workflow_and_retest(api):
    c, db = api
    a, dev = tok(c, "analyst", "Analyst#2026demo"), tok(c, "dev", "Dev#2026demo")
    c.post("/api/cycle", headers=a)
    assert c.patch("/api/findings/TS-0001", json=dict(owner="team-payments", note="looking"), headers=dev).status_code == 200
    assert c.patch("/api/findings/TS-0001", json=dict(status="False Positive"), headers=dev).status_code == 403
    assert c.patch("/api/findings/TS-0001", json=dict(status="Resolved"), headers=a).status_code == 422
    assert c.post("/api/findings/TS-0001/retest", headers=a).json()["final_status"] == "Resolved"
    f = c.get("/api/findings/TS-0001", headers=a).json()
    assert f["meta"]["owner"] == "team-payments" and f["retests"] and len(f["evidence"]) == 2


def test_plan_only_then_human_approval(api):
    c, db = api
    a = tok(c, "analyst", "Analyst#2026demo")
    r = c.post("/api/cycle?approve=false", headers=a).json()
    assert r["pending_approval"] == 5 and len(r["findings"]) == 13      # state-changing tests held back
    assert len(c.post("/api/plans/approve", headers=a).json()["findings"]) == 5
    assert db.execute("SELECT COUNT(*) FROM findings").fetchone()[0] == 18


def test_duplicate_scan_rejected_and_emergency_stop(api):
    c, _ = api
    a = tok(c, "analyst", "Analyst#2026demo")
    pipeline.STATE["running"] = True
    assert c.post("/api/cycle", headers=a).status_code == 409
    pipeline.STATE["running"] = False
    pipeline.make_guardian(connect(), 2, False)
    assert c.post("/api/safety/stop", headers=a).json()["halted"] >= 1
    assert all(g.killed for g in pipeline.ACTIVE)


def test_reports_graph_integrations(api):
    c, _ = api
    a = tok(c, "analyst", "Analyst#2026demo"); c.post("/api/cycle", headers=a)
    assert c.get("/api/reports/pdf", headers=a).content[:4] == b"%PDF"
    assert c.get("/api/reports/csv", headers=a).text.startswith("id,")
    g = c.get("/api/graph", headers=a).json()
    assert {"agency", "booking", "workflow", "endpoint"} <= {n["type"] for n in g["nodes"]}
    st = {i["name"]: i["status"] for i in c.get("/api/integrations", headers=a).json()}
    assert st["SIEM platforms"] == "Not Configured" and "Connected" not in st.values()


@pytest.mark.parametrize("n", range(1, 8))
def test_scenarios_run(n):
    pipeline.STATE["running"] = False
    steps = asyncio.run(scenarios.run(connect(), n))
    assert steps and all(s["status"] != "error" for s in steps)


def test_user_management_rules(api):
    c, _ = api
    adm, a = tok(c, "admin", "Admin#2026demo"), tok(c, "analyst", "Analyst#2026demo")
    assert c.post("/api/users", headers=a, json=dict(username="newuser", password="Strong#Pass12", role="viewer")).status_code == 403
    assert c.post("/api/users", headers=adm, json=dict(username="newuser", password="short1", role="viewer")).status_code == 422
    assert c.post("/api/users", headers=adm, json=dict(username="newuser", password="Strong#Pass12", role="viewer")).status_code == 200
    assert c.post("/api/users", headers=adm, json=dict(username="newuser", password="Strong#Pass12", role="viewer")).status_code == 409
    assert tok(c, "newuser", "Strong#Pass12")
    assert c.patch("/api/users/admin", headers=adm, json=dict(role="viewer")).status_code == 409       # last admin
    assert c.patch("/api/users/newuser", headers=adm, json=dict(role="analyst")).status_code == 200
    assert c.get("/api/roles", headers=a).json()["admin"]


def test_filters_search_notifications_lifecycle(api):
    c, _ = api
    a = tok(c, "analyst", "Analyst#2026demo")
    c.post("/api/cycle?approve=false", headers=a)
    assert len(c.get("/api/findings", params=dict(category="Missing Rate Limiting"), headers=a).json()) == 1   # auto-approved test ran
    assert c.get("/api/findings", params=dict(category="Broken Access Control (financial)"), headers=a).json() == []  # refund test still held
    cats = {f["category"] for f in c.get("/api/findings", headers=a).json()}
    assert len(c.get("/api/findings", params=dict(category=sorted(cats)[0]), headers=a).json()) >= 1
    assert c.get("/api/findings?date_from=2999-01-01", headers=a).json() == []
    s = c.get("/api/search?q=refund", headers=a).json()
    assert s["endpoints"] and c.get("/api/search?q=x", headers=a).status_code == 422
    n = c.get("/api/notifications", headers=a).json()
    assert any("await approval" in x["text"] for x in n)
    z = [x for x in c.get("/api/lifecycle", headers=a).json() if x["kind"] == "zombie"][0]
    assert z["authentication"] == "none" and z["data_classification"] == "sensitive" and z["known_findings"] >= 1
    adm = tok(c, "admin", "Admin#2026demo")
    assert c.put("/api/settings/notifications", json=dict(value="muted"), headers=adm).status_code == 200
    assert c.get("/api/notifications", headers=a).json() == []
    assert c.put("/api/settings/scan_interval_minutes", json=dict(value=99999), headers=adm).status_code == 422


def test_automation_endpoints_and_lifecycle_statuses(api):
    c, db = api
    a = tok(c, "analyst", "Analyst#2026demo")
    dev = tok(c, "dev", "Dev#2026demo")
    v = tok(c, "viewer", "Viewer#2026demo")

    # health check
    assert c.get("/api/health").json()["status"] == "healthy"

    # automation status and workflows
    st = c.get("/api/automation/status", headers=v).json()
    assert "running" in st and "paused" in st
    assert isinstance(c.get("/api/automation/workflows", headers=v).json(), list)

    # pause and resume
    assert c.post("/api/automation/pause", headers=a).json()["paused"] is True
    assert c.post("/api/automation/resume", headers=a).json()["paused"] is False

    # simulate deployment
    dep = c.post("/api/automation/deploy", json=dict(version="v2-test", commit="abcdef1"), headers=dev).json()
    assert dep["status"] == "completed"
    assert dep["workflow_id"] is not None

    # check workflows table was populated
    wfs = c.get("/api/automation/workflows", headers=v).json()
    assert len(wfs) >= 1
    assert wfs[0]["status"] == "completed"

    # test finding statuses (Assigned, In Progress, Fixed)
    assert c.patch("/api/findings/TS-0001", json=dict(owner="alice", status="Assigned"), headers=dev).status_code == 200
    assert c.patch("/api/findings/TS-0001", json=dict(status="In Progress"), headers=dev).status_code == 200
    assert c.patch("/api/findings/TS-0001", json=dict(status="Fixed"), headers=dev).status_code == 200
    f = c.get("/api/findings/TS-0001", headers=v).json()
    assert f["finding"]["status"] == "Fixed"
