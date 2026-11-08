# Architecture

    React UI (Vite) --/api--> FastAPI product API (auth, RBAC, settings)
                                  |
                      pipeline.py (orchestrator, scan lock, approval)
        change detection -> discovery -> lifecycle -> business context -> planner
                 -> SafetyGuardian -> security tests -> verification -> triage/risk -> reports -> retest
                                  |
                       SQLite (travelshield.db)         synthetic_travel_app (in-process ASGI target, v1/v2, vulnerable/fixed)

Every request to the target, including discovery and reachability probes, passes through `safety.SafetyGuardian`.
The target runs in-process via `httpx.ASGITransport`, so no sockets are opened and nothing external can be reached.

## Agents
Logical agents are modules that write real rows to `agent_events`: Change Detection (`changes.py`), Discovery (`discovery.py`),
Inventory Intelligence (`lifecycle.py`), Business Context (`business.py`), Attack Planning (`planner.py`), Security Execution (`checks.py`),
Safety Guardian (`safety.py`), Verification (`verification.py`), Triage (`triage.py`, `risk.py`), Reporting (`reporting.py`), Retesting (`pipeline.retest`).

## Tables
endpoints, lifecycle, changes, plans, scans, findings, finding_meta, evidence, retests, audit, agent_events, users, settings.

## Integration architecture
`integrations.py` defines a `Connector` interface. Only the local OpenAPI and synthetic-traffic connectors are live (status "Demo Mode").
All others are stubs with status "Ready for Integration" or "Not Configured". Nothing claims a TBO connection.
