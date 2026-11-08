# TravelShield AI (backend vertical slice)

Agentic DAST prototype for a B2B travel platform. Runs offline against a **synthetic** target
(in-process, no network). Nothing here proves anything about TBO's real systems.

## What works (tested)
- Synthetic travel target v1/v2, vulnerable and fixed modes (`synthetic_travel_app/`)
- OpenAPI + Playwright browser-crawl discovery, v1 vs v2 change detection with impact scores
- Zombie/shadow classification with evidence and 30/90-day windows (synthetic traffic)
- Business workflow mapping, deterministic explainable attack planner with approval gating
- Safety Guardian: host allowlist, method allowlist (no DELETE), request budget, rate limit, emergency stop, audit log
- 18 security tests (access control, business logic, 5 injection-indicator families, SSRF against a mock, upload, redirect, rate limit, session, data exposure)
- Independent verification (different object/actor), false-positive control, dedupe, business risk scoring
- Reports (JSON, CSV, Markdown per finding), retest on the fixed target (Resolved/Reopened)
- Agent event log, SQLite store, product API (`python -m travelshield serve`)

## Limits
See PROJECT_STATUS.md for the full list (not run on Windows, no dashboard date filter, several safety features such as health-based auto-pause are not built).

## Run (Windows PowerShell)
    .\scripts\start.ps1        # API on :8000, UI on http://localhost:5173
    python -m pytest tests       # 30 tests; 4 need: python -m playwright install chromium (skipped otherwise)
    python -m travelshield demo  # CLI cycle + retest

Demo logins (local only): admin / Admin#2026demo, analyst / Analyst#2026demo, dev / Dev#2026demo, viewer / Viewer#2026demo.
Roles: viewer reads; developer annotates findings; analyst runs scans, approvals, retests, emergency stop; admin edits settings and sees users.
