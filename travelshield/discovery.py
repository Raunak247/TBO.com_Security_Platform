from .business import workflow_of
from .db import now, log_agent

HTTP = {"get", "post", "put", "patch", "delete"}


def _body_props(spec, op):
    try:
        sch = op["requestBody"]["content"]["application/json"]["schema"]
    except KeyError:
        return []
    if "$ref" in sch:
        sch = spec["components"]["schemas"][sch["$ref"].split("/")[-1]]
    return sorted(sch.get("properties", {}))


async def discover(g, db=None):
    """Discovery Agent: reads the target's OpenAPI document through the Safety Guardian."""
    r = await g.request("discovery-agent", "discovery", "GET", "/openapi.json")
    spec, out = r.json(), []
    for path, ops in spec["paths"].items():
        for m, op in ops.items():
            if m not in HTTP:
                continue
            params = sorted({p["name"] for p in op.get("parameters", [])} | set(_body_props(spec, op)))
            out.append(dict(key=f"{m.upper()} {path}", method=m.upper(), path=path, params=params,
                            auth=bool(op.get("security")), workflow=workflow_of(path), source="openapi"))
    if db:
        log_agent(db, "Discovery Agent", "openapi discovery", "ok", f"{len(out)} endpoints discovered")
    return out
