"""Demo scenarios: each performs the real local operations and returns a step timeline."""
from . import changes, lifecycle, planner, pipeline, triage
from .business import workflow_of
from .checks import REGISTRY
from .db import rows, now
from .discovery import discover
from .safety import SafetyBlocked
from .verification import execute

EP = {"idor_cross_agency": "GET /bookings/{booking_id}", "refund_authz": "POST /bookings/{booking_id}/refund"}


def S(step, detail, status="ok"): return dict(step=step, status=status, detail=detail, ts=now())


async def _one(db, tid):
    g = pipeline.make_guardian(db, 2, False)
    v = await execute(REGISTRY[tid], g)
    steps = [S("Attack plan", f"{tid} on {EP[tid]}"), S("Safety approval", f"{g.count} guarded requests, scope synthetic-travel.local")]
    if not v:
        return steps + [S("Result", "not reproducible", "info")]
    t = v["first"].trace
    steps.append(S("Attack executed", "; ".join(f"{x['actor']} {x['method']} {x['path']} -> {x['status']}" for x in t)))
    steps.append(S("Independent verification", f"{v['status']}: {v['reason']}"))
    fid, _ = triage.store(db, REGISTRY[tid], EP[tid], workflow_of(EP[tid].split(' ', 1)[1]), v)
    f = rows(db, "SELECT * FROM findings WHERE id=?", fid)[0]
    return steps + [S("Business risk", f"{f['priority']} score {f['risk_score']}"), S("Finding", f"{fid} {f['status']}: {f['remediation']}")]


async def run(db, n):
    if n == 1:
        v1, v2 = await discover(pipeline.make_guardian(db, 1, False)), await discover(pipeline.make_guardian(db, 2, False))
        d = changes.diff(v1, v2)
        keys = {c["key"] for c in d["added"] + d["modified"]}
        p = [x for x in planner.plan(v2, keys) if x["endpoint"] in keys]
        return [S("Load v1/v2", f"{len(v1)} -> {len(v2)} endpoints")] + \
               [S("Change", f"{c['key']}: {', '.join(c['changes'])} (impact {c['impact']})") for c in d["added"] + d["modified"]] + \
               [S("Attack plan", f"{x['test_id']} on {x['endpoint']}: {x['reason']}") for x in p]
    if n == 2: return await _one(db, "idor_cross_agency")
    if n == 3: return await _one(db, "refund_authz")
    if n == 4:
        g = pipeline.make_guardian(db, 2, False)
        inv = await discover(g); z, s = lifecycle.classify(inv, lifecycle.synthetic_traffic(), await pipeline.probe(g, inv), 90)
        return [S("Zombie", f"{x['key']}: {x['evidence']}") for x in z] + [S("Shadow", f"{x['key']}: {x['evidence']}") for x in s]
    if n == 5:
        steps = await _one(db, "refund_authz")
        fid = rows(db, "SELECT id FROM findings WHERE test_id='refund_authz'")[0]["id"]
        steps.append(S("Fix deployed", "target switched to fixed synthetic build (ownership + role checks)"))
        return steps + [S("Retest", f"{fid} -> {await pipeline.retest(db, fid)}")]
    if n == 6:
        g = pipeline.make_guardian(db, 2, False)
        try:
            await g.request("planner-agent", "demo-out-of-scope", "GET", "http://169.254.169.254/latest/meta-data")
            return [S("Attempt", "NOT BLOCKED", "error")]
        except SafetyBlocked as e:
            return [S("Attempt", "request to a non-allowlisted address"), S("Guardian", f"blocked: {e.reason}", "blocked"),
                    S("Audit", "event recorded in audit log")]
    if n == 7:
        r = await pipeline.run_cycle(db)
        out = [S("Change detection", f"+{len(r['changes']['added'])} ~{len(r['changes']['modified'])}"),
               S("Discovery/inventory", f"{len(r['zombies'])} zombie, {len(r['shadows'])} shadow"),
               S("Attack planning", f"{len(r['plan'])} tests"), S("Safety/test/verify", f"{r['requests']} guarded requests"),
               S("Triage/report", f"{len(r['findings'])} findings, reports exported")]
        res = await pipeline.retest_all(db)
        return out + [S("Retesting", f"{sum(v == 'Resolved' for v in res.values())}/{len(res)} resolved on fixed target")]
    raise KeyError(n)
