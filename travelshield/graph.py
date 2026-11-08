from synthetic_travel_app.app import USERS, seed_bookings
from .db import rows


def build(db):
    nodes, edges = {}, []
    def n(i, t, label, **kw): nodes.setdefault(i, dict(id=i, type=t, label=label, findings=0, **kw))
    for u, (ag, role) in USERS.items():
        if ag == "*": n(f"user:{u}", "user", f"{u} ({role})"); continue
        n(f"agency:{ag}", "agency", f"Agency {ag}"); n(f"user:{u}", "user", f"{u} ({role})")
        edges.append((f"agency:{ag}", f"user:{u}", "employs"))
    for b in seed_bookings().values():
        n(f"booking:{b['id']}", "booking", b["id"]); n(f"payment:{b['id']}", "payment", f"PAY-{b['id'][3:]}")
        edges += [(f"agency:{b['agency']}", f"booking:{b['id']}", "owns"), (f"booking:{b['id']}", f"payment:{b['id']}", "paid by")]
    for e in rows(db, "SELECT * FROM endpoints"):
        n(f"wf:{e['workflow']}", "workflow", e["workflow"])
        n(f"ep:{e['key']}", "endpoint", e["key"])
        edges.append((f"wf:{e['workflow']}", f"ep:{e['key']}", "served by"))
        if e["workflow"] in ("booking_detail", "refund_processing", "booking_modification", "coupon_application"):
            edges.append((f"wf:{e['workflow']}", "agency:A", "touches data of"))
            edges.append((f"wf:{e['workflow']}", "agency:B", "touches data of"))
    for f in rows(db, "SELECT endpoint, COUNT(*) c FROM findings WHERE status IN ('Verified','Reopened') GROUP BY endpoint"):
        if f"ep:{f['endpoint']}" in nodes:
            nodes[f"ep:{f['endpoint']}"]["findings"] = f["c"]
    return dict(nodes=list(nodes.values()), edges=[dict(source=a, target=b, label=l) for a, b, l in edges])
