import json
from .db import now
from .risk import score


def store(db, test, endpoint, workflow, v):
    fp = f"{test.id}|{endpoint}"
    ts = now()
    sc, prio, why = score(test, workflow, v["confidence"])
    row = db.execute("SELECT id,status FROM findings WHERE fingerprint=?", (fp,)).fetchone()
    if row:  # duplicate -> correlate, do not create a second finding
        status = "Reopened" if row["status"] == "Resolved" else row["status"]
        db.execute("UPDATE findings SET last_detected=?, status=? WHERE id=?", (ts, status, row["id"]))
        fid, new = row["id"], False
    else:
        n = db.execute("SELECT COUNT(*) FROM findings").fetchone()[0] + 1
        fid, new = f"TS-{n:04d}", True
        db.execute("INSERT INTO findings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   (fid, fp, test.id, test.title, test.category, test.severity, v["status"], endpoint, workflow,
                    v["confidence"], sc, prio, json.dumps(why), test.remediation, ts, ts,
                    ts if v["status"] == "Verified" else None))
    db.execute("INSERT INTO evidence(finding_id,kind,payload,ts) VALUES(?,?,?,?)",
               (fid, "detection", json.dumps(dict(expected=test.expected, actual=v["first"].actual,
                                                  verification=v["reason"], attack=v["first"].trace,
                                                  confirmation=v["second"].trace)), ts))
    db.commit()
    return fid, new
