"""Adapter interface for future TBO integrations. Only local demo connectors are live; nothing claims a TBO connection."""
from abc import ABC, abstractmethod
from .db import rows


class Connector(ABC):
    name = purpose = status = setup = ""
    config: list = []
    event_task = None

    @abstractmethod
    def pull(self): ...

    def describe(self, db):
        ev = rows(db, "SELECT ts,message FROM agent_events WHERE task LIKE ? ORDER BY id DESC LIMIT 1", f"%{self.event_task}%") if self.event_task else []
        return dict(name=self.name, purpose=self.purpose, status=self.status, required_config=self.config,
                    setup=self.setup, last_sync=ev[0]["ts"] if ev else None, data_received=ev[0]["message"] if ev else "none")


class OpenAPILocal(Connector):
    name, purpose, status = "OpenAPI specifications", "Import endpoint definitions", "Demo Mode"
    config, setup, event_task = ["spec URL or file"], "Currently reads the synthetic target's /openapi.json through the Safety Guardian.", "openapi"
    def pull(self): return []


class TrafficLocal(Connector):
    name, purpose, status = "Traffic analytics", "Observed requests for zombie/shadow detection", "Demo Mode"
    config, setup, event_task = ["gateway log export or API"], "Uses a generated synthetic history, not real traffic.", "zombie"
    def pull(self): return []


class Stub(Connector):
    def __init__(self, name, purpose, status, config, setup):
        self.name, self.purpose, self.status, self.config, self.setup = name, purpose, status, config, setup
    def pull(self): raise NotImplementedError("no connector implemented")


CONNECTORS = [OpenAPILocal(), TrafficLocal(),
    Stub("CI/CD systems", "Trigger change-driven scans on deploy", "Ready for Integration", ["webhook URL", "pipeline token"], "Planned for Phase 3."),
    Stub("API gateways", "Live traffic for discovery", "Ready for Integration", ["gateway log endpoint"], "Planned for Phase 3."),
    Stub("Reverse proxies", "Access logs", "Not Configured", ["log path or stream"], "Planned for Phase 3."),
    Stub("Application logs", "Historical request data", "Not Configured", ["log source"], "Planned for Phase 3."),
    Stub("DNS and certificate inventory", "Find forgotten hosts", "Not Configured", ["DNS zone export"], "Planned for Phase 4."),
    Stub("Frontend bundle monitoring", "Detect new route references in JS", "Not Configured", ["bundle URLs"], "Planned for Phase 3."),
    Stub("Ticketing systems", "Open remediation tickets", "Not Configured", ["Jira/ServiceNow URL and token"], "Planned for Phase 2."),
    Stub("SIEM platforms", "Forward safety events and findings", "Not Configured", ["syslog/HEC endpoint"], "Planned for Phase 4.")]
