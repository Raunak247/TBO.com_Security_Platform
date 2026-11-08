from .business import FINANCIAL


def diff(old, new):
    o, n = {e["key"]: e for e in old}, {e["key"]: e for e in new}
    added, removed, modified = [], [], []
    for k, e in n.items():
        if k not in o:
            score = 30 + (25 if e["workflow"] in FINANCIAL else 0) + (20 if not e["auth"] else 0) \
                + (10 if any(p for p in e["params"]) else 0)
            added.append(dict(key=k, workflow=e["workflow"], impact=min(score, 100), changes=["new endpoint"]))
        else:
            ch, p_old = [], o[k]
            for p in sorted(set(e["params"]) - set(p_old["params"])):
                ch.append(f"parameter added: {p}")
            for p in sorted(set(p_old["params"]) - set(e["params"])):
                ch.append(f"parameter removed: {p}")
            if e["auth"] != p_old["auth"]:
                ch.append(f"auth requirement changed: {p_old['auth']} -> {e['auth']}")
            if ch:
                score = 15 * len(ch) + (25 if e["workflow"] in FINANCIAL else 0) + (25 if e["auth"] != p_old["auth"] else 0)
                modified.append(dict(key=k, workflow=e["workflow"], impact=min(score, 100), changes=ch))
    removed = [dict(key=k, workflow=o[k]["workflow"], impact=10, changes=["endpoint removed"]) for k in o if k not in n]
    return dict(added=added, removed=removed, modified=modified)
