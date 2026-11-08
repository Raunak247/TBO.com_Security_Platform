"""Deterministic zombie / shadow classification with evidence."""
import re


def _rx(template):
    return re.compile("^" + re.sub(r"\{[^/]+\}", r"[^/]+", template) + "$")


def synthetic_traffic():
    """Deterministic synthetic history (days_ago, hits per bucket). Not real TBO traffic."""
    def series(method, path, days, hits):
        return [dict(method=method, path=path, days_ago=d, count=hits) for d in days]
    t = []
    t += series("POST", "/auth/login", range(1, 120, 3), 30)
    t += series("GET", "/flights/search", range(1, 120, 2), 20)
    t += series("GET", "/bookings/BK-1001", range(1, 120, 4), 10)
    t += series("POST", "/bookings/BK-1002/refund", range(2, 100, 9), 3)
    t += series("POST", "/coupons/apply", range(1, 100, 6), 4)
    t += series("GET", "/api/v0/legacy/bookings", range(125, 330, 20), 5)      # silent for 125+ days -> zombie
    t += series("GET", "/api/internal/debug/config", range(1, 40, 7), 11)      # in traffic, undocumented -> shadow
    t += series("POST", "/bookings/BK-1003/modify", range(1, 12, 3), 6)
    return t


def classify(inventory, traffic, reachable, window_days=90):
    rx = {e["key"]: (e["method"], _rx(e["path"])) for e in inventory}
    stats = {}
    for o in traffic:
        key = next((k for k, (m, r) in rx.items() if m == o["method"] and r.match(o["path"])), None)
        if key is None:  # undocumented -> normalise ids so one row per route
            key = o["method"] + " " + re.sub(r"BK-\d+", "{booking_id}", o["path"])
        s = stats.setdefault(key, dict(total=0, in_window=0, last=10**6, first=0))
        s["total"] += o["count"]
        s["in_window"] += o["count"] if o["days_ago"] <= window_days else 0
        s["last"], s["first"] = min(s["last"], o["days_ago"]), max(s["first"], o["days_ago"])
    zombies, shadows = [], []
    for e in inventory:
        s = stats.get(e["key"])
        if s and s["in_window"] == 0 and s["total"] > 0 and reachable.get(e["key"], False):
            zombies.append(dict(key=e["key"], last_observed_days_ago=s["last"], historical_requests=s["total"],
                                requests_in_window=0, authenticated=e["auth"], reachable=True, window_days=window_days,
                                confidence="high" if not e["auth"] else "medium",
                                evidence=f"reachable now; 0 requests in last {window_days}d; {s['total']} historical",
                                action="decommission or enforce authentication"))
    known = {e["key"] for e in inventory}
    for k, s in stats.items():
        if k not in known and s["in_window"] > 0:
            shadows.append(dict(key=k, first_observed_days_ago=s["first"], last_observed_days_ago=s["last"],
                                requests_in_window=s["in_window"], source="traffic",
                                evidence="observed in traffic, absent from documented OpenAPI inventory",
                                action="assign owner; document or remove"))
    return zombies, shadows
