"""Security tests. Each test runs an attack and an independent verification on different objects/actors."""
import re
from dataclasses import dataclass, field

SECRET = re.compile(r"tok-\w+")


def redact(s):
    return SECRET.sub("[REDACTED-TOKEN]", s)


@dataclass
class Result:
    reproduced: bool
    control_ok: bool
    actual: str
    trace: list = field(default_factory=list)


class Ctx:
    def __init__(self, guardian, test_id):
        self.g, self.test_id, self.tokens, self.trace, self.headers = guardian, test_id, {}, [], {}

    async def call(self, method, path, user=None, bearer=None, **kw):
        h = {}
        if user:
            if user not in self.tokens:
                r = await self.g.request("security-execution-agent", self.test_id, "POST", "/auth/login",
                                         json={"username": user, "password": f"pw-{user}"})
                self.tokens[user] = r.json()["token"]
            h["Authorization"] = f"Bearer {self.tokens[user]}"
        elif bearer:
            h["Authorization"] = f"Bearer {bearer}"
        r = await self.g.request("security-execution-agent", self.test_id, method, path, headers=h, **kw)
        self.headers = r.headers
        try:
            body = r.json()
        except ValueError:
            body = None
        self.trace.append(dict(actor=user or ("anonymous" if not bearer else "invalid-token"), method=method,
                               path=path, status=r.status_code, response=redact(r.text)[:240]))
        return r.status_code, body, r.text


class Test:
    id = category = title = severity = remediation = consequence = ""
    cross_agency = False
    exposure_auth = True
    expected = ""

    async def run(self, c): raise NotImplementedError
    async def verify(self, c): raise NotImplementedError


class IDOR(Test):
    id, category, severity = "idor_cross_agency", "Broken Access Control (IDOR)", "critical"
    title = "Cross-agency booking access"
    cross_agency = True
    expected = "403/404 when an agency requests another agency's booking"
    remediation = "Enforce booking.agency == caller.agency (object-level authorization) on every booking route."
    consequence = "One agency can read another agency's bookings, passenger identities and pricing."

    async def run(self, c):
        s0, b0, _ = await c.call("GET", "/bookings/BK-1001", user="alice")
        s, b, _ = await c.call("GET", "/bookings/BK-2001", user="alice")
        return Result(s == 200 and (b or {}).get("agency") == "B", s0 == 200, f"HTTP {s}")

    async def verify(self, c):
        s, b, _ = await c.call("GET", "/bookings/BK-1003", user="bob")
        return Result(s == 200 and (b or {}).get("agency") == "A", True, f"HTTP {s}")


class Refund(Test):
    id, category, severity = "refund_authz", "Broken Access Control (financial)", "critical"
    title = "Unauthorized refund of another agency's booking"
    cross_agency = True
    expected = "403 for non-finance or foreign-agency callers"
    remediation = "Require finance/admin role AND booking ownership; reject repeat refunds and amounts above fare."
    consequence = "A sub-agent can trigger refunds on bookings it does not own (synthetic simulation)."

    async def run(self, c):
        s0, _, _ = await c.call("GET", "/bookings/BK-1002", user="alice")
        s, b, _ = await c.call("POST", "/bookings/BK-1002/refund", user="bob", json={"amount": 100.0})
        return Result(s == 200 and (b or {}).get("status") == "REFUNDED", s0 == 200, f"HTTP {s}")

    async def verify(self, c):
        s, b, _ = await c.call("POST", "/bookings/BK-1003/refund", user="carol", json={"amount": 100.0})
        return Result(s == 200 and (b or {}).get("status") == "REFUNDED", True, f"HTTP {s}")


class Coupon(Test):
    id, category, severity = "coupon_reuse", "Business Logic", "medium"
    title = "Coupon can be applied repeatedly"
    expected = "second application of the same code rejected"
    remediation = "Record redeemed codes per booking and reject repeats server-side."
    consequence = "Repeated discounts erode margin on a booking (synthetic values)."

    async def _go(self, c, bid):
        s1, b1, _ = await c.call("POST", "/coupons/apply", user="alice", json={"booking_id": bid, "code": "SAVE10"})
        s2, b2, _ = await c.call("POST", "/coupons/apply", user="alice", json={"booking_id": bid, "code": "SAVE10"})
        return Result(s2 == 200 and s1 == 200 and b2["fare"] < b1["fare"], s1 == 200, f"second apply HTTP {s2}")

    async def run(self, c): return await self._go(c, "BK-1001")
    async def verify(self, c): return await self._go(c, "BK-1002")


class Mass(Test):
    id, category, severity = "mass_assignment", "Mass Assignment", "high"
    title = "Booking fare modifiable through client-supplied fields"
    expected = "fare field ignored or request rejected"
    remediation = "Bind input to an explicit schema (seat, passenger) and reject unknown fields."
    consequence = "Callers can set their own fare on a booking (synthetic values)."

    async def _go(self, c, bid):
        s0, b0, _ = await c.call("GET", f"/bookings/{bid}", user="alice")
        await c.call("POST", f"/bookings/{bid}/modify", user="alice", json={"seat": "12A", "fare": 1.0})
        s, b, _ = await c.call("GET", f"/bookings/{bid}", user="alice")
        return Result(s == 200 and b.get("fare") == 1.0, s0 == 200, f"fare after modify = {b.get('fare') if b else None}")

    async def run(self, c): return await self._go(c, "BK-1001")
    async def verify(self, c): return await self._go(c, "BK-1002")


class Exposure(Test):
    id, category, severity = "excessive_booking_data", "Sensitive Data Exposure", "medium"
    title = "Booking response exposes internal cost and unmasked passport"
    expected = "no internal_cost; passport masked"
    remediation = "Use a response model that omits internal fields and masks identifiers."
    consequence = "Internal margin and passport-like identifiers leak to API callers."

    async def _go(self, c, bid):
        s, b, _ = await c.call("GET", f"/bookings/{bid}", user="alice")
        bad = s == 200 and ("internal_cost" in b or re.fullmatch(r"[A-Z]\d{7}", b.get("passport", "")) is not None)
        return Result(bad, s == 200, f"HTTP {s}, fields={sorted(b) if b else []}")

    async def run(self, c): return await self._go(c, "BK-1001")
    async def verify(self, c): return await self._go(c, "BK-1003")


class SQLi(Test):
    id, category, severity = "sqli_indicator", "Injection (indicator only)", "high"
    title = "Quote characters trigger a database error on flight search"
    expected = "validation error (4xx), never a database error"
    remediation = "Validate airport codes and use parameterized queries."
    consequence = "Database error leakage indicates unsafe query construction."

    async def _go(self, c, ch):
        s0, _, _ = await c.call("GET", "/flights/search", params={"origin": "DEL", "dest": "BOM"})
        s, _, t = await c.call("GET", "/flights/search", params={"origin": "DEL" + ch, "dest": "BOM"})
        return Result(s >= 500 and "sqlite" in t.lower(), s0 == 200, f"HTTP {s}")

    async def run(self, c): return await self._go(c, "'")
    async def verify(self, c): return await self._go(c, '"')


class Unauth(Test):
    id, category, severity = "unauth_sensitive", "Missing Authentication", "high"
    title = "Legacy bookings list readable without authentication"
    exposure_auth = False
    expected = "401/410 without credentials"
    remediation = "Decommission /api/v0/legacy/bookings or require authentication and agency scoping."
    consequence = "Unauthenticated callers can read booking IDs and passenger emails."

    async def run(self, c):
        s, _, t = await c.call("GET", "/api/v0/legacy/bookings")
        return Result(s == 200 and "email" in t, True, f"HTTP {s}")

    async def verify(self, c):
        s, _, t = await c.call("GET", "/api/v0/legacy/bookings", bearer="tok-nobody")
        return Result(s == 200 and "email" in t, True, f"HTTP {s} with invalid token")


class Debug(Test):
    id, category, severity = "debug_exposure", "Sensitive Configuration Exposure", "high"
    title = "Undocumented debug endpoint exposes configuration"
    exposure_auth = False
    expected = "404 for debug routes"
    remediation = "Remove the debug route from deployed builds; inventory it if it must exist."
    consequence = "Secrets and connection strings readable by anyone."

    async def run(self, c):
        s, _, t = await c.call("GET", "/api/internal/debug/config")
        return Result(s == 200 and "secret_key" in t, True, f"HTTP {s}")

    async def verify(self, c):
        s, _, t = await c.call("GET", "/api/internal/debug/config", bearer="tok-nobody")
        return Result(s == 200 and "secret_key" in t, True, f"HTTP {s} with invalid token")


class NoSQL(Test):
    id, category, severity = "nosql_indicator", "Injection (NoSQL operator, indicator only)", "high"
    title = "Query operator in booking search returns another agency's bookings"
    cross_agency = True
    expected = "operator objects rejected; results scoped to caller's agency"
    remediation = "Reject non-string filter values and always scope the query to the caller's agency."
    consequence = "Search filter operators bypass agency scoping."

    async def _go(self, c, user, own, other):
        s0, b0, _ = await c.call("POST", "/bookings/search", user=user, json={"agency": own})
        s, b, _ = await c.call("POST", "/bookings/search", user=user, json={"agency": {"$ne": own}})
        return Result(s == 200 and isinstance(b, list) and any(x["agency"] == other for x in b), s0 == 200, f"HTTP {s}")

    async def run(self, c): return await self._go(c, "alice", "A", "B")
    async def verify(self, c): return await self._go(c, "bob", "B", "A")


class Template(Test):
    id, category, severity = "template_indicator", "Injection (template, indicator only)", "high"
    title = "Template expression evaluated in greeting parameter"
    exposure_auth = False
    expected = "input echoed as text, never evaluated"
    remediation = "Render user input as data; escape it; never pass it to a template engine as a template."
    consequence = "Server-side template evaluation of user input."

    async def _go(self, c, a, b, want):
        s0, _, _ = await c.call("GET", "/agency/greeting", params={"name": "plain"})
        s, body, _ = await c.call("GET", "/agency/greeting", params={"name": "{{%d*%d}}" % (a, b)})
        return Result(s == 200 and str(want) in (body or {}).get("message", "") and "{{" not in body["message"], s0 == 200, f"HTTP {s}")

    async def run(self, c): return await self._go(c, 7, 7, 49)
    async def verify(self, c): return await self._go(c, 6, 8, 48)


class Command(Test):
    id, category, severity = "command_indicator", "Injection (command, indicator only)", "high"
    title = "Shell metacharacters change the behavior of the ping tool"
    exposure_auth = False
    expected = "metacharacters rejected by validation"
    remediation = "Validate hostnames against a strict pattern and never build shell command lines from input."
    consequence = "Indicates unsafe command construction. No command is ever executed by this test."

    async def _go(self, c, sep):
        s0, _, _ = await c.call("GET", "/tools/ping", params={"host": "example.test"})
        s, _, t = await c.call("GET", "/tools/ping", params={"host": f"example.test{sep}id"})
        return Result(s == 200 and "uid=" in t, s0 == 200, f"HTTP {s}")

    async def run(self, c): return await self._go(c, ";")
    async def verify(self, c): return await self._go(c, "|")


class Header(Test):
    id, category, severity = "header_injection", "Injection (header / CRLF)", "medium"
    title = "Line breaks accepted in a response header value"
    exposure_auth = False
    expected = "CR/LF rejected or stripped"
    remediation = "Reject control characters in any value reflected into headers."
    consequence = "Response splitting and header forgery."

    async def _go(self, c, tag):
        s0, _, _ = await c.call("GET", "/export", params={"filename": "report.csv"})
        s, _, _ = await c.call("GET", "/export", params={"filename": f"a\r\n{tag}: 1"})
        return Result(s == 200 and "\n" in c.headers.get("x-export-name", ""), s0 == 200, f"HTTP {s}")

    async def run(self, c): return await self._go(c, "X-Probe")
    async def verify(self, c): return await self._go(c, "X-Probe2")


class SSRF(Test):
    id, category, severity = "ssrf_indicator", "SSRF (local mock fixture only)", "high"
    title = "Preview endpoint fetches internal URLs"
    exposure_auth = False
    expected = "only allowlisted partner hosts accepted"
    remediation = "Allowlist outbound hosts, resolve and block private ranges, never return raw upstream bodies."
    consequence = "Server can be steered to internal services. Test only uses a built-in mock; no network request is made."

    async def _go(self, c, path, marker):
        s0, _, _ = await c.call("GET", "/preview", params={"url": "https://partner-cdn.example.test/logo.png"})
        s, _, t = await c.call("GET", "/preview", params={"url": f"http://mock-internal.local/{path}"})
        return Result(s == 200 and marker in t, s0 in (200, 400), f"HTTP {s}")

    async def run(self, c): return await self._go(c, "admin", "INTERNAL-ADMIN")
    async def verify(self, c): return await self._go(c, "metadata", "INTERNAL-METADATA")


class Upload(Test):
    id, category, severity = "file_upload", "Unrestricted File Upload", "medium"
    title = "Executable file types accepted by document upload"
    expected = "415 for non-document types"
    remediation = "Allowlist extensions and MIME types, cap size, store outside the web root."
    consequence = "Dangerous file types can be stored (harmless synthetic content used)."

    async def _go(self, c, name, ctype):
        s0, _, _ = await c.call("GET", "/bookings/BK-1001", user="alice")
        s, _, _ = await c.call("POST", "/documents/upload", user="alice", json=dict(filename=name, content_type=ctype, size=18, content="SYNTHETIC-HARMLESS"))
        return Result(s == 200, s0 == 200, f"HTTP {s}")

    async def run(self, c): return await self._go(c, "synthetic.exe", "application/x-msdownload")
    async def verify(self, c): return await self._go(c, "synthetic.sh", "text/x-shellscript")


class Redirect(Test):
    id, category, severity = "open_redirect", "Open Redirect", "medium"
    title = "Redirect endpoint sends users to arbitrary external URLs"
    exposure_auth = False
    expected = "relative paths only"
    remediation = "Accept only relative paths or an allowlist of destinations."
    consequence = "Phishing links that appear to originate from the platform. The redirect is never followed."

    async def _go(self, c, dest):
        s0, _, _ = await c.call("GET", "/redirect", params={"next": "/bookings"})
        s, _, _ = await c.call("GET", "/redirect", params={"next": dest})
        return Result(s in (301, 302, 307) and c.headers.get("location", "").startswith("https://"), s0 in (302, 307), f"HTTP {s}")

    async def run(self, c): return await self._go(c, "https://evil.example.test/a")
    async def verify(self, c): return await self._go(c, "https://other.example.test/b")


class RateLimit(Test):
    id, category, severity = "missing_rate_limit", "Missing Rate Limiting", "medium"
    title = "Login accepts unlimited failed attempts"
    exposure_auth = False
    expected = "429 after repeated failures"
    remediation = "Throttle and lock out repeated failed logins per account and per source."
    consequence = "Credential guessing is not slowed. Test uses 8 attempts against a non-existent probe account."

    async def _go(self, c, name):
        codes = [(await c.call("POST", "/auth/login", json=dict(username=name, password=f"wrong-{i}")))[0] for i in range(8)]
        return Result(429 not in codes and all(x == 401 for x in codes), True, f"codes={sorted(set(codes))}")

    async def run(self, c): return await self._go(c, "ratelimit-probe")
    async def verify(self, c): return await self._go(c, "ratelimit-probe-2")


class Session(Test):
    id, category, severity = "session_invalidation", "Improper Session Invalidation", "high"
    title = "Session token still valid after logout"
    expected = "401 after logout"
    remediation = "Revoke server-side session state on logout and on role or password change."
    consequence = "Stolen or stale tokens keep working after the user signs out."

    async def _go(self, c, user, bid):
        s0, _, _ = await c.call("GET", f"/bookings/{bid}", user=user)
        await c.call("POST", "/auth/logout", user=user)
        s, _, _ = await c.call("GET", f"/bookings/{bid}", user=user)
        return Result(s == 200, s0 == 200, f"HTTP {s} after logout")

    async def run(self, c): return await self._go(c, "sessionprobe", "BK-1001")
    async def verify(self, c): return await self._go(c, "sessionprobe2", "BK-2001")


class StackTrace(Test):
    id, category, severity = "stack_trace_exposure", "Inconsistent Error Handling / Stack Trace", "low"
    title = "Malformed booking id returns an internal stack trace"
    expected = "generic 404"
    remediation = "Return generic errors to clients and log details server-side."
    consequence = "Internal file names and query details leak to callers."

    async def _go(self, c, bid):
        s0, _, _ = await c.call("GET", "/bookings/BK-1001", user="alice")
        s, _, t = await c.call("GET", f"/bookings/{bid}", user="alice")
        return Result(s >= 500 and "Traceback" in t, s0 == 200, f"HTTP {s}")

    async def run(self, c): return await self._go(c, "BK-1001'")
    async def verify(self, c): return await self._go(c, "BK-2001'")


REGISTRY = {t.id: t() for t in (IDOR, Refund, Coupon, Mass, Exposure, SQLi, Unauth, Debug, NoSQL, Template, Command, Header, SSRF, Upload, Redirect, RateLimit, Session, StackTrace)}
