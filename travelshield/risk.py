BASE = {"critical": 9.0, "high": 7.5, "medium": 5.0, "low": 2.5}
WORKFLOW_W = {"refund_processing": 1.2, "booking_modification": 1.15, "coupon_application": 1.05,
              "booking_detail": 1.1, "platform_configuration": 1.1}


def score(test, workflow, confidence):
    s, why = BASE[test.severity], [f"technical severity {test.severity} -> base {BASE[test.severity]}"]
    w = WORKFLOW_W.get(workflow, 1.0)
    if w != 1.0:
        s *= w; why.append(f"workflow '{workflow}' x{w}")
    if test.cross_agency:
        s *= 1.1; why.append("crosses agency boundary x1.1")
    if not test.exposure_auth:
        s *= 1.1; why.append("exploitable without authentication x1.1")
    s *= (0.6 + 0.4 * confidence); why.append(f"verification confidence {confidence:.2f}")
    s = round(min(s, 10.0), 1)
    return s, ("P1" if s >= 8.5 else "P2" if s >= 6.5 else "P3"), why
