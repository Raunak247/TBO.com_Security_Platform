# Safety model and testing methodology
- Scope: host allowlist (setting `allowed_hosts`); anything else is blocked before any transport call and audited.
- Methods: GET/POST/PUT/PATCH only. No DELETE, no bulk extraction, no DoS, no OS commands, no real credentials.
- Limits: requests/second (throttled), per-scan request budget, emergency stop (halts all live guardians), single running scan.
- Approval: state-changing tests (refund, coupon, mass assignment) are held when a cycle runs with "Plan only"; an analyst approves them.
- Verification: a candidate becomes Verified only if an independent check on a different booking/actor reproduces it and the baseline control passed.
  Otherwise Needs Review or False Positive (not stored). Duplicates correlate by fingerprint (test + endpoint).
- Resolution: a finding becomes Resolved only through a retest that no longer reproduces on the fixed build. A reproduced retest marks it Reopened.
- Risk score: base by severity x workflow weight x cross-agency x unauthenticated, scaled by confidence. Every factor is listed per finding.
- Zombie: documented and reachable, historical traffic exists, zero requests in the window. Shadow: observed in traffic, absent from the documented inventory.

## Browser discovery
Playwright crawls the synthetic UI served on a loopback port. A route handler checks every request against the target host, audits it, and aborts anything else.
JS-referenced routes missing from the documented inventory are recorded as shadow candidates.

## Test families and safety notes
Injection tests are indicators only: the target simulates the behavior and nothing is executed. SSRF uses a built-in mock map and makes no network call.
Upload uses a harmless string. Open redirect responses are never followed. The rate-limit test uses a non-existent probe account (8 attempts).
Scheduled scans only plan and run auto-approved tests; state-changing tests wait for an analyst.
