import asyncio, pytest
import httpx
from travelshield import changes, lifecycle, planner, pipeline, discovery
from travelshield.db import connect, rows
from travelshield.safety import SafetyGuardian, SafetyBlocked
from travelshield.checks import REGISTRY, Test, Result
from travelshield.verification import execute
from travelshield.pipeline import make_guardian

run = asyncio.run


class CountingTransport(httpx.AsyncBaseTransport):
    calls = 0
    async def handle_async_request(self, request):
        CountingTransport.calls += 1
        return httpx.Response(200, json={})


def test_scope_blocks_external_and_never_reaches_transport():
    db, t = connect(), CountingTransport()
    g = SafetyGuardian(db, ["synthetic-travel.local"], t)
    for url in ("http://169.254.169.254/latest/meta-data", "https://www.tbo.com/"):
        with pytest.raises(SafetyBlocked):
            run(g.request("agent", "t", "GET", url))
    assert CountingTransport.calls == 0
    assert db.execute("SELECT COUNT(*) FROM audit WHERE decision='blocked'").fetchone()[0] == 2


def test_destructive_method_emergency_stop_budget_and_rate():
    db = connect(); g = make_guardian(db, 2, False, max_requests=3, max_rps=1000)
    with pytest.raises(SafetyBlocked, match="method_not_permitted"):
        run(g.request("a", "t", "DELETE", "/bookings/BK-1001"))
    for _ in range(3): run(g.request("a", "t", "GET", "/openapi.json"))
    with pytest.raises(SafetyBlocked, match="budget"): run(g.request("a", "t", "GET", "/openapi.json"))
    g2 = make_guardian(db, 2, False); g2.emergency_stop()
    with pytest.raises(SafetyBlocked, match="emergency_stop"): run(g2.request("a", "t", "GET", "/openapi.json"))
    import time
    g3 = make_guardian(db, 2, False, max_rps=5); t0 = time.monotonic()
    async def burst():
        for _ in range(8): await g3.request("a", "t", "GET", "/openapi.json")
    run(burst()); assert time.monotonic() - t0 >= 0.9


def test_version_diff():
    db = connect()
    v1 = run(discovery.discover(make_guardian(db, 1, False))); v2 = run(discovery.discover(make_guardian(db, 2, False)))
    d = changes.diff(v1, v2)
    assert {c["key"] for c in d["added"]} == {"POST /bookings/{booking_id}/modify", "GET /agency/reports/summary"}
    assert d["modified"][0]["key"] == "POST /bookings/{booking_id}/refund" and "parameter added: reason" in d["modified"][0]["changes"]


def test_zombie_and_shadow():
    db = connect(); g = make_guardian(db, 2, False)
    inv = run(discovery.discover(g)); reach = run(pipeline.probe(g, inv))
    z, s = lifecycle.classify(inv, lifecycle.synthetic_traffic(), reach, 90)
    assert [x["key"] for x in z] == ["GET /api/v0/legacy/bookings"]
    assert [x["key"] for x in s] == ["GET /api/internal/debug/config"]
    z30, _ = lifecycle.classify(inv, lifecycle.synthetic_traffic(), reach, 30)
    assert "GET /api/v0/legacy/bookings" in [x["key"] for x in z30]
    fixed = make_guardian(db, 2, True); reach2 = run(pipeline.probe(fixed, inv))
    assert lifecycle.classify(inv, lifecycle.synthetic_traffic(), reach2, 90)[0] == []  # 410 -> unreachable -> not zombie


def test_planner_selects_relevant_tests():
    db = connect(); inv = run(discovery.discover(make_guardian(db, 2, False)))
    ids = {(p["endpoint"], p["test_id"]) for p in planner.plan(inv)}
    assert ("POST /bookings/{booking_id}/refund", "refund_authz") in ids
    assert ("POST /coupons/apply", "coupon_reuse") in ids
    assert ("POST /auth/login", "missing_rate_limit") in ids
    assert not any(e == "POST /auth/login" and t in ("idor_cross_agency", "refund_authz") for e, t in ids)


def test_full_cycle_finds_verified_issues_dedupes_and_retests(tmp_path):
    db = connect()
    r = run(pipeline.run_cycle(db, tmp_path))
    f = rows(db, "SELECT * FROM findings")
    assert len(f) == 18 and {x["test_id"] for x in f} == set(REGISTRY) and all(x["status"] == "Verified" for x in f)
    assert (tmp_path / "findings.csv").exists() and (tmp_path / "TS-0001.md").exists()
    assert "tok-" not in "".join(p.read_text() for p in tmp_path.iterdir())  # secrets redacted
    run(pipeline.run_cycle(db, tmp_path))
    assert db.execute("SELECT COUNT(*) FROM findings").fetchone()[0] == 18  # deduplicated
    res = run(pipeline.retest_all(db))
    assert set(res.values()) == {"Resolved"}
    assert db.execute("SELECT COUNT(*) FROM retests").fetchone()[0] == 18


def test_fixed_target_yields_no_findings():
    db = connect(); g = make_guardian(db, 2, True)
    assert all(run(execute(t, g)) is None for t in REGISTRY.values())


def test_false_positive_control_and_needs_review():
    class Bad(Test):
        id = "bad"
        async def run(self, c): return Result(True, False, "x")
        async def verify(self, c): return Result(True, True, "x")
    class Flaky(Test):
        id = "flaky"
        async def run(self, c): return Result(True, True, "x")
        async def verify(self, c): return Result(False, True, "x")
    g = make_guardian(connect(), 2, False)
    assert run(execute(Bad(), g))["status"] == "False Positive"
    assert run(execute(Flaky(), g))["status"] == "Needs Review"


def test_emergency_stop_halts_testing():
    db = connect(); g = make_guardian(db, 2, False); g.emergency_stop()
    with pytest.raises(SafetyBlocked): run(execute(REGISTRY["idor_cross_agency"], g))


def test_scheduler_tick_runs_once_per_interval():
    from travelshield import pipeline
    from travelshield.db import put_setting
    db = connect()
    assert run(pipeline.scheduled_tick(db)) is False            # disabled by default
    put_setting(db, "scan_interval_minutes", 5)
    assert run(pipeline.scheduled_tick(db)) is True
    assert run(pipeline.scheduled_tick(db)) is False            # not due again yet
    assert db.execute("SELECT kind FROM scans").fetchone()[0] == "plan-only"
    assert db.execute("SELECT COUNT(*) FROM findings").fetchone()[0] == 13   # state-changing tests held for approval


def test_browser_discovery_finds_js_only_route_and_stays_in_scope():
    pytest.importorskip("playwright")
    from travelshield.browser_discovery import available
    if not available(): pytest.skip("Chromium for Playwright not installed")
    db = connect()
    r = run(pipeline.browser_discovery(db))
    assert "/api/internal/debug/config" in r["undocumented"] and r["blocked"] == []
    assert len(r["pages"]) >= 4
    row = db.execute("SELECT kind,evidence FROM lifecycle").fetchone()
    assert row["kind"] == "shadow" and "JavaScript" in row["evidence"]


def test_safety_guardian_ip_blocking():
    db = connect()
    g = make_guardian(db, 2, False)
    assert g._is_dangerous_host("127.0.0.1") is True
    assert g._is_dangerous_host("169.254.169.254") is True
    assert g._is_dangerous_host("10.0.0.1") is True
    assert g._is_dangerous_host("metadata.google.internal") is True
    assert g._is_dangerous_host("metadata.aws") is True
    assert g._is_dangerous_host("example.com") is False
    assert g._is_dangerous_host("8.8.8.8") is False
