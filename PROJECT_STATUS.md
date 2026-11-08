# Status
Tests: 30 total. 26 run without a browser (engine, API, RBAC, scenarios, scheduler); 4 need Chromium (browser crawl + 3 UI end-to-end).
Bandit: no issues (one deliberate fake secret in the synthetic target is annotated).

## Built and tested
- Synthetic target v1/v2, vulnerable and fixed modes, with 18 planted weaknesses, plus a small HTML UI and JS bundle for the crawler.
- Discovery: OpenAPI, synthetic traffic, and Playwright browser crawl of frontend JS (loopback only, every request allowlisted and audited).
- Change detection (v1->v2 impact scores), zombie/shadow classification (30/90d, evidence, auth, data class, known findings), workflow mapping, knowledge graph.
- Planner (explainable) with human approval for state-changing tests. Safety Guardian (scope, methods, rate, budget, emergency stop, audit).
- 18 tests: IDOR, refund authz, coupon reuse, mass assignment, data exposure, stack trace, SQL/NoSQL/template/command/header injection indicators,
  SSRF (mock only), file upload, open redirect, missing rate limit, session invalidation, unauthenticated endpoint, debug exposure.
- Independent verification, false-positive control, dedupe, business risk scoring, finding management, retesting, JSON/CSV/PDF/Markdown reports.
- Platform auth/RBAC (scrypt, lockout), user management, settings (incl. scan interval, notifications), scheduler (plan-only, never auto-approves), integration center.
- React UI for all 19 nav items, global search, notifications, category/date/status/severity filters, 7 demo scenarios.

## Known limits (not done)
- Windows & Linux tested; `scripts/start.ps1` configured and verified.
- Dashboard has no date/application filter (findings list has date, category, status, severity). Environment selector has a single option.
- Not implemented: insecure-HTTP-method tests, per-user/per-endpoint rate caps, health-based auto-pause of scans, health monitoring beyond the request budget,
  per-endpoint cooldowns, exponential backoff, maximum scan duration, CSRF (bearer tokens only), HTTPS, light theme, Docker.
- Verified findings from the same test on the same endpoint are one record; no cross-test similarity scoring beyond that fingerprint.
- Zombie/shadow traffic is generated. The 'mean time to verify' metric is near zero because verification runs inline.
- Risk weights are hand-chosen, not calibrated. Reports are PDF summary + per-finding Markdown; no per-finding PDF.
- Sessions are in memory and reset on API restart. Audit-retention and approval-policy settings are display-only.
- Integrations other than local OpenAPI/traffic are interface stubs.
Resume: `python -m pytest tests` ; `scripts\start.ps1`
