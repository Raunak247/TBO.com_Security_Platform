"""Deterministic, explainable attack planner. No LLM."""

RULES = [
    ("idor_cross_agency", lambda e: e["method"] == "GET" and "{booking_id}" in e["path"] and e["auth"],
     "Booking identifier in path on an authenticated route: object-level authorization applies.",
     "An agency can only read its own bookings.", "high", 1),
    ("excessive_booking_data", lambda e: e["method"] == "GET" and "{booking_id}" in e["path"] and e["auth"],
     "Booking detail returns personal and pricing data.", "Responses expose no internal cost or unmasked passport.", "medium", 3),
    ("refund_authz", lambda e: e["workflow"] == "refund_processing",
     "Endpoint moves money; role and agency ownership must be enforced.",
     "Only finance roles of the owning agency can refund.", "high", 1),
    ("coupon_reuse", lambda e: e["workflow"] == "coupon_application",
     "Coupon endpoint changes fare; single-use rules must hold.", "A coupon applies at most once per booking.", "medium", 2),
    ("mass_assignment", lambda e: e["workflow"] == "booking_modification",
     "Writable booking object; client-supplied fields such as fare must be ignored or rejected.",
     "Only whitelisted fields are modifiable.", "high", 1),
    ("sqli_indicator", lambda e: e["workflow"] == "flight_search" and bool(e["params"]),
     "User-controlled text parameters reach a query layer.", "Quote characters never produce database errors.", "high", 2),
    ("unauth_sensitive", lambda e: (not e["auth"]) and e["workflow"] == "booking_detail",
     "Booking data route without authentication.", "Booking data requires authentication.", "high", 1),
    ("debug_exposure", lambda e: e["workflow"] == "platform_configuration",
     "Undocumented debug route observed only in traffic.", "Debug configuration is never reachable.", "high", 1),
    ("stack_trace_exposure", lambda e: e["method"] == "GET" and "{booking_id}" in e["path"] and e["auth"],
     "Path identifier parsing; error handling must stay generic.", "Errors reveal no internals.", "low", 3),
    ("nosql_indicator", lambda e: e["path"] == "/bookings/search",
     "Structured filter object accepted from the client.", "Filter operators rejected; scope forced to caller.", "high", 2),
    ("template_indicator", lambda e: e["path"] == "/agency/greeting",
     "User text rendered into a response.", "Input is data, never evaluated.", "high", 2),
    ("command_indicator", lambda e: e["path"] == "/tools/ping",
     "Host parameter used by a network tool.", "Metacharacters rejected.", "high", 2),
    ("header_injection", lambda e: e["path"] == "/export",
     "Parameter reflected into a response header.", "CR/LF never reach headers.", "medium", 3),
    ("ssrf_indicator", lambda e: e["path"] == "/preview",
     "URL parameter fetched server-side.", "Only allowlisted hosts fetched.", "high", 2),
    ("file_upload", lambda e: e["path"] == "/documents/upload",
     "File upload accepts client-declared type and size.", "Only document types within size limit.", "medium", 2),
    ("open_redirect", lambda e: e["path"] == "/redirect",
     "Redirect target taken from a parameter.", "Only relative targets.", "medium", 3),
    ("missing_rate_limit", lambda e: e["path"] == "/auth/login",
     "Credential endpoint; throttling expected.", "429 after repeated failures.", "medium", 3),
    ("session_invalidation", lambda e: e["path"] == "/auth/logout",
     "Session termination endpoint; tokens must be revoked.", "Token rejected after logout.", "high", 2),
]
APPROVAL_REQUIRED = {"refund_authz", "mass_assignment", "coupon_reuse", "file_upload", "session_invalidation"}  # state-changing tests


def plan(inventory, changed_keys=()):
    out = []
    for e in inventory:
        for tid, cond, why, expect, risk, prio in RULES:
            if cond(e):
                boosted = e["key"] in changed_keys
                out.append(dict(endpoint=e["key"], test_id=tid, reason=why + (" Endpoint is new/changed." if boosted else ""),
                                expected_property=expect, risk=risk, priority=max(1, prio - (1 if boosted else 0)),
                                roles=["alice", "bob", "carol"], scope="synthetic target only, <=10 requests",
                                approval="required" if tid in APPROVAL_REQUIRED else "auto"))
    return sorted(out, key=lambda p: (p["priority"], p["endpoint"]))
