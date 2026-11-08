"""Safety Guardian: every request from every agent goes through here. Planner advice cannot bypass it."""
import asyncio, ipaddress, time
from collections import deque
from urllib.parse import urlparse
import httpx
from .db import now

BASE = "http://synthetic-travel.local"
PERMITTED_METHODS = {"GET", "POST", "PUT", "PATCH"}  # no DELETE / destructive verbs


class SafetyBlocked(Exception):
    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


class SafetyGuardian:
    def __init__(self, db, allowed_hosts, transport, max_requests=300, max_rps=50):
        self.db, self.allowed, self.transport = db, set(allowed_hosts), transport
        self.max_requests, self.max_rps = max_requests, max_rps
        self.count, self.killed, self.paused = 0, False, False
        self._times = deque()

    def emergency_stop(self):
        self.killed = True

    def _audit(self, actor, test, method, url, decision, reason=""):
        self.db.execute("INSERT INTO audit(ts,actor,test,method,url,decision,reason) VALUES(?,?,?,?,?,?,?)",
                        (now(), actor, test, method, url, decision, reason))
        self.db.commit()

    def _block(self, actor, test, method, url, reason):
        self._audit(actor, test, method, url, "blocked", reason)
        raise SafetyBlocked(reason)

    async def _throttle(self):
        while True:
            t = time.monotonic()
            while self._times and t - self._times[0] >= 1:
                self._times.popleft()
            if len(self._times) < self.max_rps:
                break
            await asyncio.sleep(max(0.01, 1 - (t - self._times[0])))
        self._times.append(time.monotonic())

    @staticmethod
    def _is_dangerous_host(host):
        _DANGEROUS_NAMES = {"metadata.google.internal", "metadata.aws"}
        if host in _DANGEROUS_NAMES:
            return True
        try:
            addr = ipaddress.ip_address(host)
        except ValueError:
            return False
        return addr.is_loopback or addr.is_private or addr.is_link_local or addr == ipaddress.ip_address("0.0.0.0")

    async def request(self, actor, test, method, target, headers=None, json=None, params=None):
        method = method.upper()
        url = BASE + target if target.startswith("/") else target
        host = urlparse(url).hostname
        if self.killed:
            self._block(actor, test, method, url, "emergency_stop")
        if self.paused:
            self._block(actor, test, method, url, "scan_paused")
        if host not in self.allowed:
            self._block(actor, test, method, url, f"out_of_scope:{host}")
        if self._is_dangerous_host(host):
            self._block(actor, test, method, url, f"dangerous_destination:{host}")
        if method not in PERMITTED_METHODS:
            self._block(actor, test, method, url, f"method_not_permitted:{method}")
        if self.count >= self.max_requests:
            self._block(actor, test, method, url, "request_budget_exhausted")
        await self._throttle()
        self.count += 1
        self._audit(actor, test, method, url, "allowed")
        async with httpx.AsyncClient(transport=self.transport, base_url=BASE) as c:
            return await c.request(method, url, headers=headers, json=json, params=params)
