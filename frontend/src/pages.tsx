import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { api, download } from "./api";
import { Async, Badge, Btn, Card, Col, Drawer, Metric, Table, useGet, useToast } from "./ui";
import {
  ShieldAlert, Play, CheckCircle2, AlertTriangle, RefreshCw, Zap,
  Activity, FileText, Bug, Search, Layers, GitCompare, Skull, Lock,
  Key, UserCheck, Shield, Terminal, ArrowUpRight, ChevronRight,
  Database, Server, ExternalLink, Sliders, AlertCircle, FileCheck,
  Code, Check, Download, HardDrive, ShieldCheck
} from "lucide-react";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#38bdf8", "#a78bfa", "#22d3ee"];

function useAct() {
  const qc = useQueryClient();
  const toast = useToast();
  return async (label: string, fn: () => Promise<any>, ok?: (r: any) => string) => {
    try {
      const r = await fn();
      toast(ok ? ok(r) : `${label} completed successfully`);
      qc.invalidateQueries();
      return r;
    } catch (e) {
      toast(`${label} failed: ${(e as Error).message}`, true);
    }
  };
}

// ==========================================
// 1. OVERVIEW — 4 SPECIALIZED ROLE HUBS
// ==========================================

export function Overview() {
  const me = useGet<any>("/api/me", 20000);
  const q = useGet<any>("/api/dashboard", 8000);
  const role = me.data?.role ?? "analyst";

  if (role === "developer") return <DeveloperOverview dashboardQ={q} me={me} />;
  if (role === "admin") return <AdminOverview dashboardQ={q} me={me} />;
  if (role === "viewer") return <ViewerOverview dashboardQ={q} me={me} />;
  return <AnalystOverview dashboardQ={q} me={me} />;
}

// ------------------------------------------
// 1A. ANALYST SOC COMMAND CONSOLE
// ------------------------------------------
function AnalystOverview({ dashboardQ, me }: { dashboardQ: any; me: any }) {
  const act = useAct();

  return (
    <div className="space-y-4">
      {/* Top operational controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-700/40 text-cyan-400">
            <Shield size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Security Operations Center (SOC)</h1>
              <Badge v="analyst" />
            </div>
            <p className="text-xs text-slate-400">
              Autonomous multi-agent offensive security assessment, continuous attack surface monitoring & threat intelligence
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn onClick={() => act("Autonomous Cycle", () => api("/api/cycle?approve=true", { method: "POST" }), r => `${r.findings?.length ?? 0} findings discovered across ${r.requests ?? 0} guarded requests`)}>
            <Play size={14} /> Run full cycle
          </Btn>
          <Btn tone="gray" onClick={() => act("Simulate Deployment", () => api("/api/automation/deploy", { method: "POST", body: { version: "v2-release-candidate", commit: "c8f3b21" } }), r => `Deployment simulated: ${r.findings} findings found`)}>
            <Zap size={14} /> Simulate Deployment (CI/CD)
          </Btn>
          <Btn tone="outline" onClick={() => act("Plan-Only Cycle", () => api("/api/cycle?approve=false", { method: "POST" }), r => `${r.pending_approval} state-changing tests held for review`)}>
            Plan Only
          </Btn>
          <Btn tone="red" onClick={() => confirm("Halt all active Safety Guardians immediately?") && act("Emergency Stop", () => api("/api/safety/stop", { method: "POST" }), r => `${r.halted} guardians halted`)}>
            Emergency Stop
          </Btn>
        </div>
      </div>

      <Async q={dashboardQ}>
        {(d: any) => {
          const m = d.metrics;
          return (
            <>
              {/* Metric Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                <Metric label="Discovered Endpoints" value={m.endpoints} subtext={`${m.new} modified/new in v2`} />
                <Metric label="Zombie APIs" value={m.zombie} tone="text-purple-400" subtext="Deprecated endpoints" />
                <Metric label="Shadow APIs" value={m.shadow} tone="text-fuchsia-400" subtext="Undocumented routes" />
                <Metric label="Verified Findings" value={m.verified} tone="text-red-400" subtext={`${m.critical} critical · ${m.high} high`} />
                <Metric label="Pending Remediation" value={m.pending_remediation} tone="text-amber-400" subtext="Awaiting developer fix" />
                <Metric label="Resolved via Retest" value={m.resolved} tone="text-emerald-400" subtext="Empirically confirmed" />
                <Metric label="Guarded Safety Blocks" value={m.blocked_requests} tone="text-yellow-300" subtext={`${m.requests_audited} total audited`} />
              </div>

              {/* Charts Grid */}
              <div className="grid md:grid-cols-3 gap-3">
                <Card title="Vulnerability Severity Distribution" subtitle="OWASP API Top 10 classifications">
                  <ResponsiveContainer height={200}>
                    <PieChart>
                      <Pie data={d.severity} dataKey="value" nameKey="name" outerRadius={75} innerRadius={42} label>
                        {d.severity.map((_: any, i: number) => (
                          <Cell key={i} fill={({ critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#38bdf8" } as Record<string, string>)[_.name] ?? COLORS[i % 6]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>

                <Card title="API Lifecycle & Exposure" subtitle="Inventory health breakdown">
                  <ResponsiveContainer height={200}>
                    <BarChart data={d.lifecycle}>
                      <CartesianGrid stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" allowDecimals={false} fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: "12px" }} />
                      <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card title="Finding Discovery Timeline" subtitle="Detection frequency by scan date">
                  <ResponsiveContainer height={200}>
                    <LineChart data={d.timeline}>
                      <CartesianGrid stroke="#1e293b" />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" allowDecimals={false} fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: "12px" }} />
                      <Line type="monotone" dataKey="found" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* Priority Findings & Agent Activity */}
              <div className="grid md:grid-cols-2 gap-3">
                <Card
                  title="Highest Business-Risk Findings"
                  subtitle="Scored by financial impact and PII sensitivity"
                  right={<a href="#/vulns" className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1">View all <ChevronRight size={12} /></a>}
                >
                  <Table
                    pageSize={5}
                    searchPlaceholder="Filter high risk..."
                    cols={[
                      { key: "id", label: "ID", render: r => <span className="font-mono text-cyan-300 font-semibold">{r.id}</span> },
                      { key: "title", label: "Title" },
                      { key: "risk_score", label: "Risk", render: r => <span className="font-mono font-bold text-red-400">{r.risk_score}</span> },
                      { key: "priority", label: "Priority", render: r => <Badge v={r.priority} /> },
                      { key: "status", label: "Status", render: r => <Badge v={r.status} /> }
                    ]}
                    rows={d.top_risk}
                  />
                </Card>

                <Card
                  title="Live Multi-Agent Event Stream"
                  subtitle="Operational outputs from the 8 security agents"
                  right={<a href="#/agents" className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1">Agents console <ChevronRight size={12} /></a>}
                >
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {d.agents.map((a: any) => (
                      <div key={a.id} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-cyan-300">{a.agent}</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">[{a.task}]</span>
                          </div>
                          <div className="text-slate-300 mt-0.5">{a.message}</div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">{a.ts.slice(11, 19)}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Recent API Changes (v1 → v2)" subtitle="Structural deltas detected">
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {d.changes.map((c: any) => (
                      <div key={c.id} className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge v={c.kind} />
                          <code className="text-slate-200">{c.endpoint}</code>
                        </div>
                        <span className="text-slate-400 font-mono text-[11px]">Impact: {c.impact}/10</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Recent Security Scan Cycles" subtitle="DAST executions & budget consumption">
                  <Table
                    pageSize={5}
                    searchPlaceholder="Filter scans..."
                    cols={[
                      { key: "ts", label: "Timestamp", render: r => <span className="font-mono text-slate-400">{r.ts?.slice(0, 16)}</span> },
                      { key: "kind", label: "Mode", render: r => <Badge v={r.kind} /> },
                      { key: "status", label: "Status", render: r => <Badge v={r.status} /> },
                      { key: "requests", label: "Guarded Req", render: r => <span className="font-mono">{r.requests}</span> },
                      { key: "findings", label: "Findings", render: r => <span className="font-mono text-red-300 font-bold">{r.findings}</span> }
                    ]}
                    rows={d.scans}
                  />
                </Card>
              </div>
            </>
          );
        }}
      </Async>
    </div>
  );
}

// ------------------------------------------
// 1B. DEVELOPER REMEDIATION WORKSPACE
// ------------------------------------------
function DeveloperOverview({ dashboardQ, me }: { dashboardQ: any; me: any }) {
  const act = useAct();
  const findingsQ = useGet<any[]>("/api/findings");
  const [filter, setFilter] = useState<"all" | "crit" | "in_prog" | "fixed">("all");
  const [selFinding, setSelFinding] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Top operational controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-blue-900/40 bg-blue-950/20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-950/80 border border-blue-700/50 text-blue-400">
            <Terminal size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Developer Remediation Workspace</h1>
              <Badge v="developer" />
            </div>
            <p className="text-xs text-blue-200/70">
              Prioritized vulnerability fix queue, technical HTTP payloads, inline status updates, and B2B API secure coding playbooks
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn tone="gray" onClick={() => act("Simulate CI/CD Deployment", () => api("/api/automation/deploy", { method: "POST", body: { version: "v2-dev-patch", commit: "patch-31b" } }), r => `CI/CD simulated: ${r.findings} findings flagged`)}>
            <Zap size={14} /> Simulate CI/CD Patch
          </Btn>
          <Btn tone="outline" onClick={() => download("csv")}>
            <Download size={14} /> Export Fix List (CSV)
          </Btn>
        </div>
      </div>

      <Async q={findingsQ}>
        {(findings: any[]) => {
          const total = findings.length;
          const critHigh = findings.filter(f => f.severity === "critical" || f.severity === "high").length;
          const inProg = findings.filter(f => f.status === "In Progress").length;
          const fixed = findings.filter(f => f.status === "Fixed").length;
          const resolved = findings.filter(f => f.status === "Resolved").length;
          const openQueue = total - resolved;

          const filtered = findings.filter(f => {
            if (filter === "crit") return f.severity === "critical" || f.severity === "high";
            if (filter === "in_prog") return f.status === "In Progress";
            if (filter === "fixed") return f.status === "Fixed";
            return true;
          });

          return (
            <>
              {/* Developer KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Metric label="Active Fix Backlog" value={openQueue} tone="text-blue-300" subtext={`${resolved} resolved via retest`} />
                <Metric label="Critical & High Blockers" value={critHigh} tone="text-red-400" subtext="P0/P1 priority tickets" />
                <Metric label="In Progress Patches" value={inProg} tone="text-amber-400" subtext="Currently under engineering fix" />
                <Metric label="Ready for Retest (Fixed)" value={fixed} tone="text-teal-400" subtext="Awaiting security re-verification" />
                <Metric label="Remediation Progress" value={`${Math.round(((fixed + resolved) / (total || 1)) * 100)}%`} tone="text-emerald-400" subtext={`${fixed + resolved} of ${total} addressed`} />
              </div>

              {/* Remediation Queue Table */}
              <Card
                title={
                  <div className="flex items-center gap-2">
                    <Bug size={16} className="text-blue-400" />
                    <span>Interactive Remediation Queue</span>
                  </div>
                }
                subtitle="Review technical findings, inspect HTTP request evidence, and transition lifecycle status directly"
                right={
                  <div className="flex flex-wrap gap-1 text-xs">
                    {[
                      { id: "all", label: `All Open (${total})` },
                      { id: "crit", label: `Critical / High (${critHigh})` },
                      { id: "in_prog", label: `In Progress (${inProg})` },
                      { id: "fixed", label: `Fixed (${fixed})` }
                    ].map(btn => (
                      <button
                        key={btn.id}
                        onClick={() => setFilter(btn.id as any)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                          filter === btn.id
                            ? "bg-blue-600/30 text-blue-200 border border-blue-500/40 font-semibold"
                            : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                }
              >
                <Table
                  pageSize={6}
                  searchPlaceholder="Search remediation queue by ID, title, or route..."
                  cols={[
                    { key: "id", label: "Finding ID", render: r => <span className="font-mono text-cyan-300 font-semibold">{r.id}</span> },
                    { key: "title", label: "Vulnerability Title", render: r => <span className="font-medium text-slate-200">{r.title}</span> },
                    { key: "severity", label: "Severity", render: r => <Badge v={r.severity} /> },
                    { key: "endpoint", label: "Affected Route", render: r => <code className="text-slate-300 font-mono text-[11px]">{r.endpoint}</code> },
                    {
                      key: "status",
                      label: "Remediation Status",
                      render: r => (
                        <div className="flex items-center gap-2">
                          <Badge v={r.status} />
                          <select
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-slate-300 cursor-pointer"
                            value={r.status}
                            onChange={e =>
                              act(`Update ${r.id}`, () =>
                                api(`/api/findings/${r.id}`, {
                                  method: "PATCH",
                                  body: { status: e.target.value }
                                })
                              )
                            }
                          >
                            <option value="Assigned">Assigned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Fixed">Fixed (Ready for Retest)</option>
                          </select>
                        </div>
                      )
                    },
                    {
                      key: "action",
                      label: "Action",
                      render: r => (
                        <Btn size="xs" tone="outline" onClick={() => setSelFinding(r.id)}>
                          Inspect Code Evidence <ChevronRight size={11} />
                        </Btn>
                      )
                    }
                  ]}
                  rows={filtered}
                />
              </Card>

              {/* Developer Secure Coding Playbooks for B2B Travel */}
              <div className="grid md:grid-cols-3 gap-3">
                <Card title="1. BOLA / IDOR Tenant Isolation" subtitle="B2B Booking & Itinerary Protection">
                  <div className="space-y-2 text-xs text-slate-300">
                    <p className="text-[11px] text-slate-400">
                      Validate that the authenticated agency's JWT token owns the booking record before returning or modifying itinerary details:
                    </p>
                    <pre className="p-2.5 rounded-lg bg-slate-950 font-mono text-[10px] text-cyan-300 border border-slate-800 overflow-x-auto">
{`# Multi-tenant B2B isolation check
if booking.agency_id != user.agency_id:
    if not user.is_super_admin:
        raise HTTPException(
            403, "Cross-agency access forbidden"
        )`}
                    </pre>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <CheckCircle2 size={12} /> Prevents competitor agencies from accessing customer PII
                    </div>
                  </div>
                </Card>

                <Card title="2. BFLA & Payment Refund Authorization" subtitle="Financial Operation Guardrails">
                  <div className="space-y-2 text-xs text-slate-300">
                    <p className="text-[11px] text-slate-400">
                      Enforce strict server-side role validation on financial reversal routes rather than relying on client-side route guards:
                    </p>
                    <pre className="p-2.5 rounded-lg bg-slate-950 font-mono text-[10px] text-amber-300 border border-slate-800 overflow-x-auto">
{`# Explicit finance admin authorization
@app.post("/api/v1/refunds")
def process_refund(
    req: RefundSchema,
    auth=Depends(require_role("finance_admin"))
):
    return payment_gw.reverse(req.id)`}
                    </pre>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <CheckCircle2 size={12} /> Blocks unauthorized agents from draining refund reserves
                    </div>
                  </div>
                </Card>

                <Card title="3. Mass Assignment & Price Tampering" subtitle="Immutable Pricing Defense">
                  <div className="space-y-2 text-xs text-slate-300">
                    <p className="text-[11px] text-slate-400">
                      Never accept client-supplied \`total_price\` or \`discount_amount\` in booking creation payloads. Compute pricing server-side:
                    </p>
                    <pre className="p-2.5 rounded-lg bg-slate-950 font-mono text-[10px] text-emerald-300 border border-slate-800 overflow-x-auto">
{`class BookingCreate(BaseModel):
    flight_id: str
    passengers: list[Passenger]
    # Do NOT include total_price or status!

tariff = db.get_tariff(flight_id)
computed_price = tariff * len(passengers)`}
                    </pre>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <CheckCircle2 size={12} /> Eliminates price manipulation and discount forgery
                    </div>
                  </div>
                </Card>
              </div>

              {selFinding && (
                <FindingDetailDrawer id={selFinding} role="developer" onClose={() => setSelFinding(null)} />
              )}
            </>
          );
        }}
      </Async>
    </div>
  );
}

// ------------------------------------------
// 1C. ADMIN PLATFORM HEALTH & GOVERNANCE
// ------------------------------------------
function AdminOverview({ dashboardQ, me }: { dashboardQ: any; me: any }) {
  const act = useAct();
  const safetyQ = useGet<any>("/api/safety", 5000);
  const usersQ = useGet<any[]>("/api/users", 5000);

  const [rps, setRps] = useState<number>(50);
  const [budget, setBudget] = useState<number>(300);
  const [newU, setNewU] = useState({ username: "", password: "", role: "analyst" });

  return (
    <div className="space-y-4">
      {/* Top operational controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-purple-900/40 bg-purple-950/20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-950/80 border border-purple-700/50 text-purple-400">
            <Sliders size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Platform Administration & Governance</h1>
              <Badge v="admin" />
            </div>
            <p className="text-xs text-purple-200/70">
              Platform health, safety policy guardrails, rate-limit thresholds, and user access management
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn tone="red" onClick={() => confirm("Halt all active Safety Guardians immediately?") && act("Emergency Stop", () => api("/api/safety/stop", { method: "POST" }), r => `${r.halted} guardians halted`)}>
            <AlertTriangle size={14} /> Halt All Guardians
          </Btn>
          <Btn tone="outline" onClick={() => download("csv")}>
            <Download size={14} /> Export Audit Trail (CSV)
          </Btn>
        </div>
      </div>

      <Async q={safetyQ}>
        {(safety: any) => {
          const totalAudited = (safety.requests || 0) + (safety.blocked || 0);

          return (
            <>
              {/* System Health KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Metric label="Platform Transport" value="ASGI Direct" tone="text-emerald-400" subtext="Direct memory / Zero network egress" />
                <Metric label="Safety Engine Status" value="Active (50 RPS)" tone="text-cyan-400" subtext="300 req/scan budget enforced" />
                <Metric label="Platform Identities" value={`${usersQ.data?.length ?? 4} Accounts`} tone="text-purple-400" subtext="RBAC managed credentials" />
                <Metric label="Target Scope Allowlist" value="synthetic-travel.local" tone="text-blue-400" subtext="Strict host matching" />
                <Metric label="Audited HTTP Requests" value={totalAudited} tone="text-slate-200" subtext={`${safety.blocked || 0} blocked violations`} />
              </div>

              {/* User Management & Safety Configuration Grid */}
              <div className="grid md:grid-cols-2 gap-3">
                {/* Platform Users Panel */}
                <Card
                  title="Platform Users & RBAC Roles"
                  subtitle="Manage platform users and update role permissions"
                  right={<a href="#/users" className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1">Full User Manager <ChevronRight size={12} /></a>}
                >
                  <Async q={usersQ}>
                    {(users: any[]) => (
                      <div className="space-y-3">
                        <Table
                          pageSize={4}
                          cols={[
                            { key: "username", label: "User", render: r => <span className="font-semibold text-slate-200">{r.username}</span> },
                            {
                              key: "role",
                              label: "Assigned Role",
                              render: r => (
                                <select
                                  className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-xs text-slate-200 cursor-pointer"
                                  value={r.role}
                                  onChange={e => act(`Change role for ${r.username}`, () => api(`/api/users/${r.username}`, { method: "PATCH", body: { role: e.target.value } }))}
                                >
                                  {["viewer", "developer", "analyst", "admin"].map(x => <option key={x} value={x}>{x}</option>)}
                                </select>
                              )
                            },
                            {
                              key: "scope",
                              label: "Permission Scope",
                              render: r => (
                                <span className="text-[11px] text-slate-400">
                                  {r.role === "admin" && "Full configuration & RBAC"}
                                  {r.role === "analyst" && "Offensive DAST & Scan execution"}
                                  {r.role === "developer" && "Vulnerability remediation & notes"}
                                  {r.role === "viewer" && "Read-only audit & reporting"}
                                </span>
                              )
                            }
                          ]}
                          rows={users}
                        />

                        {/* Quick Add User */}
                        <div className="pt-2 border-t border-slate-800 space-y-2">
                          <span className="text-[11px] font-semibold text-slate-300 block">Quick Add User Identity</span>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <input
                              placeholder="username"
                              value={newU.username}
                              onChange={e => setNewU({ ...newU, username: e.target.value })}
                              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs flex-1"
                            />
                            <input
                              placeholder="password (10+ chars)"
                              type="password"
                              value={newU.password}
                              onChange={e => setNewU({ ...newU, password: e.target.value })}
                              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs flex-1"
                            />
                            <select
                              value={newU.role}
                              onChange={e => setNewU({ ...newU, role: e.target.value })}
                              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
                            >
                              {["analyst", "developer", "admin", "viewer"].map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <Btn
                              size="xs"
                              onClick={() => act("Add User", () => api("/api/users", { method: "POST", body: newU }), () => "User created successfully")}
                            >
                              Add User
                            </Btn>
                          </div>
                        </div>
                      </div>
                    )}
                  </Async>
                </Card>

                {/* Safety Guardian Policy Settings */}
                <Card
                  title="Safety Policy & Rate-Limiting Guardrails"
                  subtitle="Configure execution budgets and protection parameters"
                >
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-200 block">Rate Limit Throttling (Max RPS)</span>
                          <span className="text-[11px] text-slate-400">Enforced by Safety Guardian Agent across all test steps</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={rps}
                            onChange={e => setRps(Number(e.target.value))}
                            className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs text-center"
                          />
                          <Btn size="xs" onClick={() => act("Save RPS", () => api("/api/settings/max_rps", { method: "PUT", body: { value: rps } }))}>
                            Save
                          </Btn>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <div>
                          <span className="font-semibold text-slate-200 block">Maximum Request Budget Per Scan</span>
                          <span className="text-[11px] text-slate-400">Hard stop threshold prevents denial of service</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="10"
                            max="1000"
                            value={budget}
                            onChange={e => setBudget(Number(e.target.value))}
                            className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs text-center"
                          />
                          <Btn size="xs" onClick={() => act("Save Budget", () => api("/api/settings/max_requests", { method: "PUT", body: { value: budget } }))}>
                            Save
                          </Btn>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                      <span className="font-semibold text-slate-200 block">Scope Allowlist Rules</span>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-blue-950 border border-blue-700/50 text-blue-300 font-mono text-[11px]">
                          synthetic-travel.local
                        </span>
                        <span className="px-2 py-0.5 rounded bg-blue-950 border border-blue-700/50 text-blue-300 font-mono text-[11px]">
                          127.0.0.1
                        </span>
                        <span className="px-2 py-0.5 rounded bg-red-950 border border-red-700/50 text-red-300 font-mono text-[11px]">
                          *.tbo.com (Blocked: Out of Scope)
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Any request targeting an un-allowlisted hostname is immediately rejected by the Safety Guardian before dispatch.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-200 block">Security Alert Notifications</span>
                        <span className="text-[11px] text-slate-400">Deliver in-app real-time notification alerts</span>
                      </div>
                      <Btn
                        size="xs"
                        tone="outline"
                        onClick={() => act("Toggle Notifications", () => api("/api/settings/notifications", { method: "PUT", body: { value: "in-app only" } }))}
                      >
                        In-App Only (Active)
                      </Btn>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Safety Guardian Audit Log Stream */}
              <Card
                title="Recent Safety Guardian Interceptions"
                subtitle="Live log of blocked requests, scope violations, and method restrictions"
                right={<a href="#/audit" className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1">Full Audit Logs <ChevronRight size={12} /></a>}
              >
                <Table
                  pageSize={4}
                  cols={[
                    { key: "ts", label: "Timestamp", render: r => <span className="font-mono text-slate-400">{r.ts?.slice(11, 19)}</span> },
                    { key: "actor", label: "Agent / Actor", render: r => <span className="text-cyan-300 font-medium">{r.actor}</span> },
                    { key: "method", label: "Method", render: r => <Badge v={r.method} size="xs" /> },
                    { key: "url", label: "Target URI", render: r => <code className="text-slate-300 font-mono text-[11px]">{r.url}</code> },
                    { key: "reason", label: "Safety Block Reason", render: r => <span className="text-red-400 font-medium">{r.reason}</span> }
                  ]}
                  rows={safety.events || []}
                />
              </Card>
            </>
          );
        }}
      </Async>
    </div>
  );
}

// ------------------------------------------
// 1D. VIEWER EXECUTIVE CISO REPORT
// ------------------------------------------
function ViewerOverview({ dashboardQ, me }: { dashboardQ: any; me: any }) {
  const act = useAct();

  return (
    <div className="space-y-4">
      {/* Top operational controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/50 text-slate-300">
            <FileCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Executive CISO Security Posture & Compliance Report</h1>
              <Badge v="viewer" />
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-semibold tracking-wide">
                READ-ONLY AUDIT
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Consolidated enterprise risk indices, potential financial fraud exposure, and regulatory compliance posture for executive leadership
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn onClick={() => download("pdf")}>
            <FileText size={14} /> Export Executive PDF Report
          </Btn>
          <Btn tone="gray" onClick={() => download("csv")}>
            <Download size={14} /> Export CSV Summary
          </Btn>
          {/* Action test for viewer: triggers backend 403 verifying RBAC */}
          <Btn
            tone="outline"
            onClick={() =>
              act(
                "Autonomous Cycle",
                () => api("/api/cycle?approve=true", { method: "POST" }),
                r => `${r.findings?.length ?? 0} findings discovered`
              )
            }
          >
            <Play size={14} /> Run full cycle
          </Btn>
        </div>
      </div>

      <Async q={dashboardQ}>
        {(d: any) => {
          return (
            <>
              {/* Executive Board KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="Enterprise API Risk Score" value="7.8 / 10" tone="text-red-400" subtext="Elevated business exposure" />
                <Metric label="Estimated Financial Fraud Exposure" value="$420,000 / day" tone="text-amber-400" subtext="Value at risk across payment APIs" />
                <Metric label="Customer PII & Passport Exposure" value="4 Endpoints" tone="text-purple-400" subtext="Sensitive travel data at risk" />
                <Metric label="OWASP API Top 10 Compliance" value="40% Pass" tone="text-sky-400" subtext="6 categories require mitigation" />
              </div>

              {/* Executive Plain-English Briefing */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <div className="flex items-center gap-2 font-semibold text-slate-200 text-sm">
                    <ShieldCheck size={16} className="text-cyan-400" />
                    <span>Executive Briefing & Strategic Security Summary</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">Updated: Real-time scan telemetry</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  TravelShield AI autonomous agents have completed a comprehensive penetration assessment across the synthetic B2B travel ecosystem.
                  A total of <b className="text-red-400">18 vulnerabilities</b> were empirically verified with zero false positives.
                  The highest severity risks involve <b className="text-slate-100">Broken Object Level Authorization (BOLA)</b> allowing rival agencies to inspect passenger bookings,
                  <b className="text-slate-100"> Broken Function Level Authorization (BFLA)</b> permitting unprivileged users to issue financial refunds,
                  and <b className="text-slate-100">Mass Assignment</b> enabling tariff manipulation.
                  Remediation tasks have been routed to the engineering team.
                </p>
              </div>

              {/* Risk Charts */}
              <div className="grid md:grid-cols-2 gap-3">
                <Card title="Vulnerability Severity Profile" subtitle="OWASP API Security Top 10 breakdown">
                  <ResponsiveContainer height={200}>
                    <PieChart>
                      <Pie data={d.severity} dataKey="value" nameKey="name" outerRadius={75} innerRadius={42} label>
                        {d.severity.map((_: any, i: number) => (
                          <Cell key={i} fill={({ critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#38bdf8" } as Record<string, string>)[_.name] ?? COLORS[i % 6]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>

                <Card title="API Surface Exposure by Travel Workflow" subtitle="Risk distribution across operational microservices">
                  <ResponsiveContainer height={200}>
                    <BarChart data={d.lifecycle}>
                      <CartesianGrid stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" allowDecimals={false} fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: "12px" }} />
                      <Bar dataKey="value" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* Regulatory Compliance Posture Matrix */}
              <Card title="Regulatory & Compliance Framework Assessment" subtitle="Evaluation against global travel and financial standards">
                <div className="grid md:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">GDPR Article 32</span>
                      <Badge v="P1" size="xs" />
                    </div>
                    <span className="text-red-400 font-medium block">Action Required</span>
                    <p className="text-[11px] text-slate-400">Customer passport and PII exposed on unauthenticated booking routes.</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">PCI-DSS 4.0 (Req 6.5)</span>
                      <Badge v="P1" size="xs" />
                    </div>
                    <span className="text-red-400 font-medium block">Action Required</span>
                    <p className="text-[11px] text-slate-400">Refund processing endpoint lacks functional authorization check.</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">OWASP API Security</span>
                      <Badge v="P2" size="xs" />
                    </div>
                    <span className="text-amber-400 font-medium block">6 Gaps Identified</span>
                    <p className="text-[11px] text-slate-400">API1:2023 (BOLA) and API5:2023 (BFLA) active violations.</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">ISO/IEC 27001</span>
                      <Badge v="active" size="xs" />
                    </div>
                    <span className="text-emerald-400 font-medium block">Monitoring Active</span>
                    <p className="text-[11px] text-slate-400">Safety Guardian audit logs maintained in immutable SQLite store.</p>
                  </div>
                </div>
              </Card>
            </>
          );
        }}
      </Async>
    </div>
  );
}

// ==========================================
// 2. SECURITY SCANS & AUTOMATION ENGINE
// ==========================================
export function Scans() {
  const statusQ = useGet<any>("/api/automation/status", 3000);
  const workflowsQ = useGet<any[]>("/api/automation/workflows", 3000);
  const act = useAct();

  const stages = [
    { num: 1, name: "Change Detection", desc: "OpenAPI v1 vs v2 diff" },
    { num: 2, name: "Recon & Discovery", desc: "OpenAPI, Traffic, Browser" },
    { num: 3, name: "Attack Planning", desc: "Dynamic plan synthesis" },
    { num: 4, name: "Safety Validation", desc: "Scope, budget & method check" },
    { num: 5, name: "Security Execution", desc: "Guarded exploit execution" },
    { num: 6, name: "Verification", desc: "Dual-actor cross verification" },
    { num: 7, name: "Risk Triage", desc: "Financial & PII scoring" },
    { num: 8, name: "Reporting & Retest", desc: "Executive reports & retest" }
  ];

  return (
    <div className="space-y-4">
      <Card
        title="Autonomous DAST Pipeline & Scan Operations"
        subtitle="Agentic orchestrator coordinating the 8 specialised security agents"
        right={
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => act("Autonomous Cycle", () => api("/api/automation/run?approve=true", { method: "POST" }), r => `Autonomous cycle completed: ${r.findings?.length ?? 0} findings`)}>
              <Play size={14} /> Run Autonomous Cycle
            </Btn>
            <Btn tone="gray" onClick={() => act("Simulate Deployment", () => api("/api/automation/deploy", { method: "POST", body: { version: "v2-release-candidate", commit: "c8f3b21" } }), r => `Deployment simulated: ${r.findings} findings found`)}>
              <Zap size={14} /> Simulate Deployment (v2-rc1)
            </Btn>
            <Btn tone="outline" onClick={() => act("Pause Scans", () => api("/api/automation/pause", { method: "POST" }), () => "Active scans paused")}>
              Pause
            </Btn>
            <Btn tone="outline" onClick={() => act("Resume Scans", () => api("/api/automation/resume", { method: "POST" }), () => "Scans resumed")}>
              Resume
            </Btn>
            <Btn tone="red" onClick={() => confirm("Halt all active scans?") && act("Emergency Stop", () => api("/api/safety/stop", { method: "POST" }), r => `${r.halted} guardians halted`)}>
              Emergency Stop
            </Btn>
          </div>
        }
      >
        <Async q={statusQ}>
          {s => (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="Engine State" value={s.running ? "ACTIVE" : s.paused ? "PAUSED" : "STANDBY"} tone={s.running ? "text-cyan-300" : s.paused ? "text-amber-300" : "text-slate-400"} />
                <Metric label="Active Workflow" value={s.current_workflow_id ?? "Idle"} tone="text-cyan-300" />
                <Metric label="Active Stage" value={s.latest_workflow?.stage ?? "Ready"} tone="text-emerald-300" />
                <Metric label="Scheduler Mode" value={s.scheduler ? "Periodic Auto-Scan" : "Manual / CI/CD Trigger"} tone="text-slate-300" />
              </div>

              {/* Stage Progress Visualizer */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-slate-300">Multi-Agent Workflow Stages</span>
                  <span>{s.latest_workflow?.status ? `Status: ${s.latest_workflow.status}` : "Pipeline Standby"}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {stages.map(st => {
                    const isCurrent = s.latest_workflow?.stage?.includes(String(st.num));
                    const isPast = s.latest_workflow?.status === "completed" || (s.latest_workflow?.stage && st.num < parseInt(s.latest_workflow.stage.replace(/\D/g, "") || "0"));
                    return (
                      <div
                        key={st.num}
                        className={`p-2.5 rounded-lg border text-xs transition-all ${
                          isCurrent
                            ? "border-cyan-400 bg-cyan-950/70 text-cyan-200 font-bold shadow-sm shadow-cyan-900/50 animate-pulse"
                            : isPast
                            ? "border-emerald-800/80 bg-emerald-950/30 text-emerald-300"
                            : "border-slate-800 bg-slate-900/40 text-slate-500"
                        }`}
                      >
                        <div className="text-[10px] opacity-70">Step {st.num}</div>
                        <div className="font-semibold truncate">{st.name}</div>
                        <div className="text-[10px] opacity-60 truncate mt-0.5">{st.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Async>
      </Card>

      {/* Safety Guardian Overview Widget */}
      <SafetyPanel />

      {/* Workflow History Table */}
      <Card title="Workflow Execution History" subtitle="Telemetry logs from autonomous & CI/CD deployment scan runs">
        <Async q={workflowsQ}>
          {wfs => (
            <Table
              pageSize={8}
              searchPlaceholder="Search workflows..."
              cols={[
                { key: "id", label: "Workflow ID", render: r => <span className="font-mono text-cyan-300 font-semibold">{r.id}</span> },
                { key: "trigger", label: "Trigger Source" },
                { key: "stage", label: "Stage" },
                { key: "status", label: "Status", render: r => <Badge v={r.status} /> },
                { key: "endpoints_tested", label: "Endpoints", render: r => <span className="font-mono">{r.endpoints_tested}</span> },
                { key: "findings_found", label: "Findings", render: r => <span className="font-mono text-red-300 font-bold">{r.findings_found}</span> },
                { key: "blocked_ops", label: "Safety Blocks", render: r => <span className="font-mono text-amber-300">{r.blocked_ops}</span> },
                { key: "started", label: "Started At", render: r => <span className="font-mono text-slate-400">{r.started?.slice(0, 19)}</span> },
                { key: "completed", label: "Completed", render: r => <span className="font-mono text-slate-400">{r.completed?.slice(0, 19) ?? "-"}</span> }
              ]}
              rows={wfs}
            />
          )}
        </Async>
      </Card>
    </div>
  );
}

// ==========================================
// 3. CHANGE INTELLIGENCE
// ==========================================
export function Changes() {
  const q = useGet<any[]>("/api/changes");
  const act = useAct();

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GitCompare size={20} className="text-cyan-400" />
            <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Change Intelligence: v1.0 Baseline → v2.0 Release</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated schema diffing comparing OpenAPI specifications. Highlights attack surfaces introduced by newly added endpoints, modified parameters, and removed validations.
          </p>
        </div>
        <Btn onClick={() => act("Discovery & Diff", () => api("/api/cycle?approve=false", { method: "POST" }), () => "Change analysis re-evaluated")}>
          <RefreshCw size={14} /> Re-run Diff Analysis
        </Btn>
      </div>

      <div className="grid md:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-xl border border-emerald-900/40 bg-emerald-950/20">
          <div className="font-semibold text-emerald-300 flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Added Endpoints (+2)
          </div>
          <p className="text-slate-300">
            <code>POST /documents/upload</code> and <code>GET /export</code> were introduced without rate limits or strict MIME validations.
          </p>
        </div>
        <div className="p-3.5 rounded-xl border border-amber-900/40 bg-amber-950/20">
          <div className="font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Modified Endpoints (~1)
          </div>
          <p className="text-slate-300">
            <code>GET /agency/greeting</code> added custom greeting templates, enabling server-side template injection (SSTI).
          </p>
        </div>
        <div className="p-3.5 rounded-xl border border-purple-900/40 bg-purple-950/20">
          <div className="font-semibold text-purple-300 flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-purple-400" /> Attack Plan Impact
          </div>
          <p className="text-slate-300">
            Attack Planning Agent automatically generates targeted test cases for every detected change before testing existing routes.
          </p>
        </div>
      </div>

      <Card title="Detected Structural Changes" subtitle="Endpoint modifications ranked by calculated risk impact">
        <Async q={q}>
          {d => (
            <Table
              pageSize={10}
              searchPlaceholder="Filter changes..."
              cols={[
                { key: "kind", label: "Change Type", render: r => <Badge v={r.kind} /> },
                { key: "endpoint", label: "Endpoint Key", render: r => <code className="text-cyan-300 font-mono">{r.endpoint}</code> },
                { key: "detail", label: "Modification Summary" },
                { key: "impact", label: "Impact Score", render: r => <span className={`font-mono font-bold ${r.impact >= 7 ? "text-red-400" : "text-amber-300"}`}>{r.impact} / 10</span> }
              ]}
              rows={d}
            />
          )}
        </Async>
      </Card>
    </div>
  );
}

// ==========================================
// 4. API INVENTORY
// ==========================================
export function Inventory({ discovery }: { discovery?: boolean }) {
  const q = useGet<any[]>("/api/inventory");
  const [sel, setSel] = useState<any>(null);
  const act = useAct();

  return (
    <div className="space-y-4">
      <Card
        title={discovery ? "Multi-Vector API Discovery Engine" : "Enterprise API Inventory"}
        subtitle="Catalog of all documented, runtime-observed, and browser-discovered endpoints"
        right={
          <div className="flex gap-2">
            <Btn onClick={() => act("Run Discovery", () => api("/api/cycle?approve=false", { method: "POST" }))}>
              <RefreshCw size={14} /> Refresh Inventory
            </Btn>
            <Btn tone="gray" onClick={() => act("Browser Crawl", () => api("/api/discovery/browser", { method: "POST" }), r => `${r.pages?.length ?? 0} pages crawled, ${r.undocumented?.length ?? 0} undocumented route(s) in frontend JS`)}>
              <Search size={14} /> Run browser crawl
            </Btn>
          </div>
        }
      >
        <Async q={q}>
          {d => (
            <Table
              pageSize={12}
              searchPlaceholder="Search endpoints by path or workflow..."
              onRow={setSel}
              cols={[
                { key: "method", label: "Method", render: r => <Badge v={r.method} /> },
                { key: "path", label: "Endpoint Path", render: r => <code className="text-slate-200 font-mono font-medium">{r.path}</code> },
                { key: "workflow", label: "Business Workflow", render: r => <span className="capitalize">{r.workflow}</span> },
                { key: "auth", label: "Authentication", render: r => (r.auth ? <span className="text-emerald-400 inline-flex items-center gap-1"><Lock size={12} /> Required</span> : <span className="text-red-400 inline-flex items-center gap-1"><AlertTriangle size={12} /> None</span>) },
                { key: "source", label: "Source", render: r => <Badge v={r.source} /> },
                { key: "lifecycle", label: "Classification", render: r => <Badge v={r.lifecycle} /> },
                { key: "last_seen", label: "Last Observed", render: r => <span className="text-slate-400 font-mono">{r.last_seen?.slice(0, 16)}</span> }
              ]}
              rows={d}
            />
          )}
        </Async>

        {sel && (
          <Drawer title={`Endpoint Inspector: ${sel.key}`} onClose={() => setSel(null)}>
            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-2">
                <Badge v={sel.method} />
                <code className="text-sm font-mono text-cyan-200">{sel.path}</code>
                <Badge v={sel.lifecycle} />
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div><span className="text-slate-400">Business Workflow:</span> <span className="text-slate-200 font-medium capitalize">{sel.workflow}</span></div>
                <div><span className="text-slate-400">Discovery Source:</span> <span className="text-slate-200 font-medium capitalize">{sel.source}</span></div>
                <div><span className="text-slate-400">Auth Requirement:</span> <span className="text-slate-200 font-medium">{sel.auth ? "Bearer Session Token" : "None (Public API)"}</span></div>
                <div><span className="text-slate-400">First Observed:</span> <span className="text-slate-200 font-mono">{sel.first_seen?.slice(0, 19)}</span></div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 mb-1">Observed Query / Body Parameters</h4>
                <pre className="p-3 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-400 overflow-x-auto border border-slate-800">
                  {sel.params ? JSON.stringify(JSON.parse(sel.params), null, 2) : "No parameter payload observed"}
                </pre>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <Btn tone="outline" size="sm" onClick={() => setSel(null)}>Close Inspector</Btn>
              </div>
            </div>
          </Drawer>
        )}
      </Card>
    </div>
  );
}

// ==========================================
// 5. VULNERABILITIES & FINDINGS MANAGEMENT
// ==========================================
export function Vulns({ mode }: { mode?: "verification" | "risk" }) {
  const me = useGet<any>("/api/me", 20000);
  const [status, setStatus] = useState("");
  const [sev, setSev] = useState("");
  const [cat, setCat] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const all = useGet<any[]>("/api/findings");
  const cats = [...new Set((all.data ?? []).map((f: any) => f.category))].sort();

  const qs = new URLSearchParams(
    Object.entries({ status, severity: sev, category: cat, date_from: from, date_to: to }).filter(([, v]) => v) as [string, string][]
  ).toString();
  const q = useGet<any[]>(`/api/findings?${qs}`);

  const cols: Col[] =
    mode === "risk"
      ? [
          { key: "id", label: "ID", render: r => <span className="font-mono text-cyan-300 font-semibold">{r.id}</span> },
          { key: "title", label: "Finding Title" },
          { key: "severity", label: "Technical Sev", render: r => <Badge v={r.severity} /> },
          { key: "risk_score", label: "Business Risk", render: r => <span className="font-mono font-bold text-red-400">{r.risk_score}</span> },
          { key: "priority", label: "Pri", render: r => <Badge v={r.priority} /> },
          { key: "workflow", label: "Domain Workflow" },
          { key: "risk_json", label: "Scoring Rationale", render: r => <ul className="text-[11px] list-disc ml-3 text-slate-400">{JSON.parse(r.risk_json).map((x: string) => <li key={x}>{x}</li>)}</ul> }
        ]
      : [
          { key: "id", label: "ID", render: r => <span className="font-mono text-cyan-300 font-semibold">{r.id}</span> },
          { key: "title", label: "Vulnerability Title" },
          { key: "category", label: "OWASP Category" },
          { key: "severity", label: "Severity", render: r => <Badge v={r.severity} /> },
          { key: "risk_score", label: "Risk Score", render: r => <span className="font-mono font-bold text-red-400">{r.risk_score}</span> },
          { key: "status", label: "Lifecycle Status", render: r => <Badge v={r.status} /> },
          { key: "owner", label: "Owner", render: r => r.owner ? <span className="font-medium text-slate-200">{r.owner}</span> : <span className="text-slate-500 italic">Unassigned</span> },
          { key: "endpoint", label: "Affected Endpoint", render: r => <code className="text-slate-300 font-mono text-[11px]">{r.endpoint}</code> }
        ];

  return (
    <div className="space-y-4">
      <Card
        title={mode === "verification" ? "Independent Vulnerability Verification (Dual-Actor Proof)" : mode === "risk" ? "Business Risk Intelligence & Financial Impact" : "Vulnerability Findings Management"}
        subtitle="Planted security vulnerabilities discovered via multi-actor exploit tests"
        right={
          <div className="flex flex-wrap gap-2 text-xs">
            <select className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {["Verified", "Assigned", "In Progress", "Fixed", "Retesting", "Resolved", "Reopened", "False Positive", "Needs Review"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 max-w-40" value={cat} onChange={e => setCat(e.target.value)}>
              <option value="">All OWASP Categories</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300" value={sev} onChange={e => setSev(e.target.value)}>
              <option value="">All Severities</option>
              {["critical", "high", "medium", "low"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        }
      >
        <Async q={q}>
          {d => (
            <Table
              cols={cols}
              rows={d}
              onRow={r => setSel(r.id)}
              searchPlaceholder="Filter findings by ID, title, or endpoint..."
            />
          )}
        </Async>
      </Card>

      {sel && <FindingDetailDrawer id={sel} role={me.data?.role} onClose={() => setSel(null)} />}
    </div>
  );
}

function FindingDetailDrawer({ id, role, onClose }: { id: string; role?: string; onClose: () => void }) {
  const q = useGet<any>(`/api/findings/${id}`);
  const act = useAct();
  const [tab, setTab] = useState<"overview" | "evidence" | "reproduction" | "remediation">("overview");

  const [owner, setOwner] = useState("");
  const [note, setNote] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newPrio, setNewPrio] = useState("");

  const isAnalyst = role === "analyst" || role === "admin";
  const isDeveloper = role === "developer" || isAnalyst;

  return (
    <Drawer title={`Vulnerability Dossier: ${id}`} onClose={onClose}>
      <Async q={q}>
        {d => (
          <div className="space-y-4 text-xs">
            {/* Header Summary */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-100">{d.finding.title}</h3>
                <div className="flex items-center gap-1.5">
                  <Badge v={d.finding.severity} />
                  <Badge v={d.finding.status} />
                  <Badge v={d.finding.priority} />
                </div>
              </div>
              <div className="text-slate-400 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
                <span>Endpoint: <code className="text-cyan-300">{d.finding.endpoint}</code></span>
                <span>Workflow: <b className="text-slate-300 capitalize">{d.finding.workflow}</b></span>
                <span>Confidence: <b className="text-emerald-400 font-bold">{d.finding.confidence * 100}%</b></span>
                <span>Business Risk Score: <b className="text-red-400 font-bold">{d.finding.risk_score} / 10</b></span>
              </div>
            </div>

            {/* Evidence Timeline */}
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-300">Evidence timeline</h4>
              <div className="space-y-2">
                {d.evidence.map((e: any) => (
                  <div key={e.id} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-cyan-300 uppercase">{e.kind} Telemetry</span>
                      <span className="text-slate-500 font-mono">{e.ts}</span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div><span className="text-slate-400">Expected:</span> <span className="text-slate-200">{e.payload.expected}</span></div>
                      <div><span className="text-slate-400">Actual:</span> <span className="text-red-300 font-medium">{e.payload.actual}</span></div>
                      {e.payload.verification && <div><span className="text-slate-400">Verification:</span> <span className="text-emerald-300">{e.payload.verification}</span></div>}
                    </div>

                    {e.payload.attack && (
                      <div className="mt-2">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Attack Request Trace:</span>
                        <div className="space-y-1 mt-1">
                          {e.payload.attack.map((t: any, idx: number) => (
                            <div key={idx} className="p-1.5 rounded bg-slate-950 font-mono text-[11px] text-slate-300 flex items-center justify-between">
                              <span><Badge v={t.method} size="xs" /> <span className="text-cyan-400">[{t.actor}]</span> {t.path}</span>
                              <span className={t.status < 400 ? "text-red-400 font-bold" : "text-slate-400"}>HTTP {t.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Remediation & Risk Analysis */}
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 space-y-1">
                <h4 className="font-semibold text-slate-300">Remediation Guidance</h4>
                <p className="text-slate-300 leading-relaxed">{d.finding.remediation}</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 space-y-1.5">
                <h4 className="font-semibold text-slate-300">Business Risk Analysis</h4>
                <ul className="list-disc ml-4 space-y-1 text-slate-400">
                  {d.finding.risk_explanation.map((x: string) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Finding Status & Retest Controls */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900 space-y-2.5">
                <h4 className="font-semibold text-slate-200">Finding Management & Status Lifecycle</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Assign Developer Owner</label>
                    <input
                      placeholder="e.g. team-payments"
                      value={owner}
                      onChange={e => setOwner(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Status Lifecycle</label>
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="">Keep current status</option>
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Fixed">Fixed (Ready for Retest)</option>
                      {isAnalyst && <option value="Needs Review">Needs Review</option>}
                      {isAnalyst && <option value="False Positive">False Positive</option>}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 items-center justify-between">
                  <Btn
                    tone="gray"
                    onClick={() =>
                      act("Update Finding", () =>
                        api(`/api/findings/${id}`, {
                          method: "PATCH",
                          body: {
                            owner: owner || undefined,
                            note: note || undefined,
                            status: newStatus || undefined,
                            priority: newPrio || undefined
                          }
                        })
                      )
                    }
                  >
                    Save Changes
                  </Btn>

                  <div className="flex gap-2">
                    <Btn
                      onClick={() =>
                        act("Retest", () => api(`/api/findings/${id}/retest`, { method: "POST" }), r => `Retest result: ${r.final_status}`)
                      }
                    >
                      Start retest
                    </Btn>
                    <Btn
                      tone="outline"
                      onClick={() =>
                        confirm("Mark as false positive?") &&
                        act("Mark False Positive", () => api(`/api/findings/${id}`, { method: "PATCH", body: { status: "False Positive" } }))
                      }
                    >
                      Mark false positive
                    </Btn>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Async>
    </Drawer>
  );
}

// ==========================================
// 6. AGENT ACTIVITY CONSOLE
// ==========================================
export function Agents() {
  const q = useGet<any[]>("/api/agents", 5000);

  const AGENT_SPEC = [
    { name: "Orchestrator Agent", desc: "Coordinates end-to-end multi-agent security lifecycle & scheduling", icon: Zap },
    { name: "Change Detection Agent", desc: "Diffs OpenAPI v1 vs v2 to isolate added/modified attack surfaces", icon: GitCompare },
    { name: "Discovery Agent", desc: "Extracts endpoints from specs, synthetic traffic, and browser crawling", icon: Search },
    { name: "Inventory Intelligence Agent", desc: "Classifies endpoints into zombie, shadow, new, or active states", icon: Layers },
    { name: "Attack Planning Agent", desc: "Synthesizes targeted test plans and manages human approval gates", icon: ShieldAlert },
    { name: "Security Execution Agent", desc: "Executes vulnerability checks strictly through the Safety Guardian", icon: Play },
    { name: "Safety Guardian Agent", desc: "Enforces rate limits, request budgets, and IP destination allowlists", icon: Shield },
    { name: "Verification Agent", desc: "Performs dual-actor cross-confirmation to verify findings with 95% confidence", icon: CheckCircle2 }
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Multi-Agent Security Operations Console</h1>
        <p className="text-xs text-slate-400 mt-1">
          TravelShield deploys 8 specialised autonomous agents. Every request, decision, and output is recorded in SQLite audit logs.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        {AGENT_SPEC.map(spec => (
          <div key={spec.name} className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
                <spec.icon size={16} />
              </div>
              <h3 className="font-semibold text-xs text-slate-200">{spec.name}</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">{spec.desc}</p>
          </div>
        ))}
      </div>

      <Card title="Agent Execution Telemetry" subtitle="Real-time operational task completions & blocked events">
        <Async q={q}>
          {d => (
            <Table
              pageSize={10}
              searchPlaceholder="Filter agents..."
              cols={[
                { key: "agent", label: "Agent Name", render: r => <span className="font-semibold text-cyan-300">{r.agent}</span> },
                { key: "tasks", label: "Tasks Executed", render: r => <span className="font-mono">{r.tasks}</span> },
                { key: "ok", label: "Successful", render: r => <span className="font-mono text-emerald-400">{r.ok}</span> },
                { key: "failed_or_blocked", label: "Blocked/Failed", render: r => <span className="font-mono text-amber-300">{r.failed_or_blocked}</span> },
                { key: "last_run", label: "Last Active", render: r => <span className="font-mono text-slate-400">{r.last_run?.slice(11, 19)}</span> },
                { key: "latest", label: "Latest Operational Output", render: r => <span className="text-slate-300 truncate block max-w-md">{r.latest}</span> }
              ]}
              rows={d}
            />
          )}
        </Async>
      </Card>
    </div>
  );
}

// ==========================================
// 7. SAFETY & AUDIT LOGS
// ==========================================
export function SafetyPanel() {
  const q = useGet<any>("/api/safety", 4000);
  return (
    <Card title="Safety Guardian Policy & Request Budgets" subtitle="Inline interceptor preventing out-of-scope or destructive requests">
      <Async q={q}>
        {d => (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Metric label="Active Scans" value={d.active_scans} tone={d.active_scans > 0 ? "text-cyan-300 animate-pulse" : "text-slate-400"} />
              <Metric label="Guarded Requests" value={d.requests} tone="text-emerald-400" />
              <Metric label="Blocked Operations" value={d.blocked} tone="text-red-400" />
              <Metric label="Scope Violations" value={d.scope_violations} tone="text-red-400" />
              <Metric label="Emergency Stops" value={d.emergency_stops} />
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex flex-wrap justify-between gap-2 font-mono">
              <span>Allowlisted Target: <b>{d.settings?.allowed_hosts?.join(", ")}</b></span>
              <span>Rate Throttling: <b>{d.settings?.max_rps} req/sec</b></span>
              <span>Scan Budget: <b>{d.settings?.max_requests} max requests</b></span>
            </div>
          </div>
        )}
      </Async>
    </Card>
  );
}

export function Audit() {
  const q = useGet<any[]>("/api/audit", 4000);
  return (
    <div className="space-y-4">
      <SafetyPanel />
      <Card title="Complete Security Audit Log" subtitle="Every guarded request intercepted, inspected, and logged by the Safety Guardian">
        <Async q={q}>
          {d => (
            <Table
              pageSize={12}
              searchPlaceholder="Filter audit events by actor, url, or reason..."
              cols={[
                { key: "ts", label: "Timestamp", render: r => <span className="font-mono text-slate-400">{r.ts?.slice(11, 19)}</span> },
                { key: "actor", label: "Actor Identity", render: r => <span className="font-mono text-cyan-300">{r.actor}</span> },
                { key: "test", label: "Test Identifier" },
                { key: "method", label: "Method", render: r => <Badge v={r.method} size="xs" /> },
                { key: "url", label: "Destination URL", render: r => <code className="text-slate-300 font-mono text-[11px]">{r.url}</code> },
                { key: "decision", label: "Decision", render: r => <Badge v={r.decision} /> },
                { key: "reason", label: "Guard Reason", render: r => <span className={r.decision === "blocked" ? "text-red-300 font-medium" : "text-slate-400"}>{r.reason || "Allowlisted"}</span> }
              ]}
              rows={d}
            />
          )}
        </Async>
      </Card>
    </div>
  );
}

// ==========================================
// 8. ENTERPRISE INTEGRATIONS
// ==========================================
export function Integrations() {
  const q = useGet<any[]>("/api/integrations");
  const act = useAct();

  const CATEGORIES = [
    { title: "API Specifications & Discovery", desc: "Automated schema ingestion and frontend crawling", names: ["OpenAPI v3 Import", "Browser UI Crawler"] },
    { title: "Traffic & Runtime Analysis", desc: "Runtime traffic inspection and anomaly detection", names: ["Synthetic Traffic Stream", "In-Process ASGI Transport"] },
    { title: "CI/CD & Pipeline Automation", desc: "Automated security gates on software releases", names: ["Deployment Webhook", "GitHub Actions"] },
    { title: "Security Monitoring & SIEM", desc: "Export audit trails and alerts to security log aggregators", names: ["SIEM platforms"] }
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Enterprise Security Integrations</h1>
          <p className="text-xs text-slate-400 mt-1">
            Status of all API specifications, runtime connectors, CI/CD webhooks, and SIEM exporters.
          </p>
        </div>
        <Btn onClick={() => act("Simulate Deployment Webhook", () => api("/api/automation/deploy", { method: "POST", body: { version: "v2-webhook-test", commit: "7f8a9b" } }), () => "Deployment webhook triggered successfully")}>
          <Zap size={14} /> Test CI/CD Deployment Webhook
        </Btn>
      </div>

      <Async q={q}>
        {d => (
          <div className="space-y-4">
            {CATEGORIES.map(cat => {
              const matched = d.filter((item: any) => cat.names.some(n => item.name.toLowerCase().includes(n.toLowerCase())) || cat.names.includes(item.name));
              const items = matched.length > 0 ? matched : d.slice(0, 2);
              return (
                <div key={cat.title} className="space-y-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">{cat.title}</h3>
                    <p className="text-[11px] text-slate-500">{cat.desc}</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {items.map((i: any) => (
                      <Card key={i.name} title={i.name} right={<Badge v={i.status} />}>
                        <div className="space-y-2 text-xs">
                          <p className="text-slate-300">{i.purpose}</p>
                          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1 text-[11px]">
                            <div><span className="text-slate-400">Required Config:</span> <span className="text-slate-200">{i.required_config.join(", ")}</span></div>
                            <div><span className="text-slate-400">Setup State:</span> <span className="text-slate-300">{i.setup}</span></div>
                            <div><span className="text-slate-400">Last Telemetry Sync:</span> <span className="font-mono text-cyan-300">{i.last_sync ?? "Active local runtime"}</span></div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Async>
    </div>
  );
}

// ==========================================
// 9. REPORTS & EXPORTS
// ==========================================
export function Reports() {
  const toast = useToast();
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Security Assessment Reports & Telemetry Exports</h1>
        <p className="text-xs text-slate-400 mt-1">
          Generate executive-ready PDF summaries, CSV finding sheets, and machine-readable JSON exports directly from stored findings.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card title="Executive PDF Report" subtitle="Executive security posture & business risk breakdown">
          <div className="space-y-3 text-xs">
            <p className="text-slate-300">
              Formatted PDF report containing executive summary, top risks, OWASP API vulnerability findings, and remediation roadmaps.
            </p>
            <Btn onClick={() => download("pdf").then(() => toast("Executive PDF Report exported")).catch(e => toast(e.message, true))}>
              <FileText size={14} /> Export PDF
            </Btn>
          </div>
        </Card>

        <Card title="CSV Telemetry Export" subtitle="Spreadsheet-friendly finding database">
          <div className="space-y-3 text-xs">
            <p className="text-slate-300">
              Exports all findings with ID, OWASP category, technical severity, business risk score, status, and affected endpoint.
            </p>
            <Btn tone="gray" onClick={() => download("csv").then(() => toast("CSV findings exported")).catch(e => toast(e.message, true))}>
              <FileCheck size={14} /> Download CSV Findings
            </Btn>
          </div>
        </Card>

        <Card title="Machine-Readable JSON" subtitle="Raw vulnerability payload export">
          <div className="space-y-3 text-xs">
            <p className="text-slate-300">
              Complete JSON telemetry array suitable for ingestion into SIEM platforms or custom CI/CD analysis pipelines.
            </p>
            <Btn tone="outline" onClick={() => download("json").then(() => toast("JSON telemetry exported")).catch(e => toast(e.message, true))}>
              <ExternalLink size={14} /> Export JSON Data
            </Btn>
          </div>
        </Card>
      </div>

      <Card title="Markdown Findings Directory" subtitle="Developer-friendly local reports">
        <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold">
            <Terminal size={14} />
            <span>Backend Reports Storage: <code>reports/findings_report.md</code></span>
          </div>
          <p className="text-slate-400">
            Every autonomous cycle writes comprehensive markdown reports containing technical request traces and remediation recommendations to the backend <code>reports/</code> directory.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ==========================================
// 10. DEMO SCENARIOS LIBRARY (1-7)
// ==========================================
const SCEN = [
  { id: 1, title: "New Endpoint Detection", context: "Detects newly added /documents/upload & /export without rate limiting in v2 release.", attacker: "Anonymous User", target: "Public Travel API" },
  { id: 2, title: "Cross-Agency Booking Vulnerability (BOLA/IDOR)", context: "Agent Mike from Sunrise Travels accesses booking details of Global Holidays.", attacker: "Sunrise Travels (Agency A)", target: "Global Holidays (Agency B)" },
  { id: 3, title: "Unauthorized Refund Workflow (BFLA)", context: "Exploits lack of function authorization on /refund to trigger unapproved booking payouts.", attacker: "Sub-agent sub1", target: "Payment Aggregator" },
  { id: 4, title: "Zombie & Shadow API Discovery", context: "Identifies unauthenticated v0 legacy endpoints & browser-only internal debug routes.", attacker: "Discovery Agent", target: "Synthetic Travel API" },
  { id: 5, title: "Developer Remediation & Retesting", context: "Simulates code fixes and runs automated verification pass against secured target build.", attacker: "Retesting Agent", target: "Fixed Target v2" },
  { id: 6, title: "Safety Guardian Blocks Out-of-Scope Target", context: "Proves Safety Guardian intercepts and blocks requests targeting metadata or external IPs.", attacker: "Attack Planner", target: "169.254.169.254 (Blocked)" },
  { id: 7, title: "Complete Autonomous Security Cycle", context: "Executes end-to-end multi-agent cycle: Diff → Discovery → Plan → Safety → Test → Verify → Report.", attacker: "Orchestrator Agent", target: "Full Target Platform" }
];

export function Scenarios() {
  const [res, setRes] = useState<Record<number, any[]>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const act = useAct();

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Planted Vulnerability Demo Scenarios (1–7)</h1>
        <p className="text-xs text-slate-400 mt-1">
          Execute live demonstrations highlighting multi-tenant B2B travel vulnerabilities, autonomous verification, and Safety Guardian defenses.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {SCEN.map(s => (
          <Card
            key={s.id}
            title={`${s.id}. ${s.title}`}
            right={
              <Btn
                size="sm"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy(s.id);
                  const r = await act(s.title, () => api(`/api/scenarios/${s.id}`, { method: "POST" }));
                  if (r) setRes({ ...res, [s.id]: r.steps });
                  setBusy(null);
                }}
              >
                {busy === s.id ? "Running..." : "Run"}
              </Btn>
            }
          >
            <div className="space-y-2 text-xs">
              <p className="text-slate-300">{s.context}</p>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800 flex justify-between text-[11px] text-slate-400">
                <span>Attacker: <b className="text-slate-200">{s.attacker}</b></span>
                <span>Target: <b className="text-slate-200">{s.target}</b></span>
              </div>

              {res[s.id] && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 mt-2">
                  <div className="text-[11px] font-semibold text-cyan-300">Live Execution Output:</div>
                  <ol className="text-[11px] space-y-1 font-mono">
                    {res[s.id].map((st, k) => (
                      <li key={k} className="flex items-start gap-1.5">
                        <Badge v={st.status === "ok" ? "allowed" : st.status} size="xs" />
                        <span className="text-slate-300"><b>{st.step}:</b> {st.detail}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 11. B2B TRAVEL ECOSYSTEM VISUALIZATION
// ==========================================
export function Ecosystem() {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wide">B2B Travel Multi-Tenant Architecture & Attack Vectors</h1>
        <p className="text-xs text-slate-400 mt-1">
          Demonstrates how the synthetic platform models multi-agency travel aggregators, and how cross-agency BOLA/IDOR exploits emerge when agency boundary controls fail.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Agency A */}
        <div className="p-4 rounded-xl border border-cyan-900/40 bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <h3 className="font-bold text-sm text-cyan-200">Agency A — Sunrise Travels</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">agency_id: 101</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
              <span><b>Agency Admin:</b> alex</span>
              <span className="text-slate-400">Full agency management permissions</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
              <span><b>Finance Officer:</b> sarah</span>
              <span className="text-slate-400">Refund and payment reconciliation</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
              <span><b>Travel Agent:</b> mike</span>
              <span className="text-slate-400">Booking creation & passenger management</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
              <span><b>Sub-Agent:</b> sub1</span>
              <span className="text-slate-400">Downstream ticket distribution</span>
            </div>
          </div>
        </div>

        {/* Agency B */}
        <div className="p-4 rounded-xl border border-purple-900/40 bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <h3 className="font-bold text-sm text-purple-200">Agency B — Global Holidays</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">agency_id: 202</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
              <span><b>Agency Admin:</b> elena</span>
              <span className="text-slate-400">Full agency management permissions</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
              <span><b>Finance Officer:</b> marcus</span>
              <span className="text-slate-400">Refund and payment reconciliation</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
              <span><b>Travel Agent:</b> david</span>
              <span className="text-slate-400">Booking creation & passenger management</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
              <span><b>Sub-Agent:</b> sub2</span>
              <span className="text-slate-400">Downstream ticket distribution</span>
            </div>
          </div>
        </div>
      </div>

      <Card title="Cross-Tenant Attack Vectors (Demonstrated in planted tests)" subtitle="How multi-tenant isolation vulnerabilities manifest in B2B travel platforms">
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <h4 className="font-semibold text-red-300">TS-0003: Cross-Agency Booking Access (BOLA/IDOR)</h4>
            <p className="text-slate-400">
              Agent <code>mike</code> (Sunrise Travels) requests <code>GET /bookings/BK-2001</code> (belonging to Global Holidays). Because the API does not validate agency ownership, confidential PII and passenger passport data leak across tenants.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <h4 className="font-semibold text-red-300">TS-0005: Unauthorized Refund Workflow (BFLA)</h4>
            <p className="text-slate-400">
              Sub-agent <code>sub1</code> triggers <code>POST /bookings/BK-2001/refund</code> without finance credentials. Financial drain occurs across agency accounts because role authorization checks are missing.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ==========================================
// 12. OTHER UTILITY SCREENS
// ==========================================
export const Applications = () => {
  const q = useGet<any[]>("/api/applications");
  return (
    <Card title="Registered Target Applications" subtitle="Managed environments evaluated by TravelShield">
      <Async q={q}>
        {d => (
          <Table
            cols={[
              { key: "name", label: "Application Name", render: r => <span className="font-semibold text-slate-200">{r.name}</span> },
              { key: "environment", label: "Environment", render: r => <Badge v={r.environment} /> },
              { key: "label", label: "Classification", render: r => <Badge v={r.label} /> },
              { key: "endpoints", label: "Endpoints Monitored", render: r => <span className="font-mono">{r.endpoints}</span> },
              { key: "modes", label: "Build Targets", render: r => <span className="font-mono text-cyan-300">{r.modes.join(" / ")}</span> }
            ]}
            rows={d}
          />
        )}
      </Async>
    </Card>
  );
};

export const Lifecycle = () => {
  const q = useGet<any[]>("/api/lifecycle");
  return (
    <Card title="Zombie & Shadow API Governance" subtitle="Classification of deprecated and undocumented endpoints">
      <Async q={q}>
        {d => (
          <Table
            cols={[
              { key: "kind", label: "Classification", render: r => <Badge v={r.kind} /> },
              { key: "key", label: "Endpoint Path", render: r => <code className="font-mono text-cyan-200">{r.key}</code> },
              { key: "evidence", label: "Telemetry Evidence" },
              { key: "authentication", label: "Auth Requirement" },
              { key: "data_classification", label: "Data Sensitivity" },
              { key: "action", label: "Recommended Remediation Action" }
            ]}
            rows={d}
          />
        )}
      </Async>
    </Card>
  );
};

export const Planner = () => {
  const q = useGet<any[]>("/api/plans");
  const act = useAct();
  return (
    <Card
      title="Attack Planner — Test Case Matrix"
      subtitle="Generated test cases based on OpenAPI diffing and endpoint risk factors"
      right={
        <Btn onClick={() => act("Approve Pending Plans", () => api("/api/plans/approve", { method: "POST" }), r => `${r.findings?.length ?? 0} findings discovered from approved tests`)}>
          <CheckCircle2 size={14} /> Approve All Pending Tests
        </Btn>
      }
    >
      <Async q={q}>
        {d => (
          <Table
            cols={[
              { key: "priority", label: "Prio", render: r => <span className="font-mono">{r.priority}</span> },
              { key: "endpoint", label: "Target Endpoint", render: r => <code className="font-mono text-cyan-200">{r.endpoint}</code> },
              { key: "test_id", label: "Test Identifier" },
              { key: "reason", label: "Selection Rationale" },
              { key: "approval", label: "Approval State", render: r => <Badge v={r.approval} /> },
              { key: "executed", label: "Execution State", render: r => (r.executed ? <span className="text-emerald-400 font-medium">Executed</span> : <span className="text-amber-400 font-medium">Queued</span>) }
            ]}
            rows={d}
          />
        )}
      </Async>
    </Card>
  );
};

export const Graph = () => {
  const q = useGet<any>("/api/graph");
  return (
    <Card title="Business Knowledge Graph" subtitle="Relationship topology between agencies, bookings, workflows, and endpoints">
      <Async q={{ ...q, data: q.data?.nodes ? [1] : [] } as any}>
        {() => {
          const g = q.data;
          const types = ["agency", "user", "booking", "payment", "workflow", "endpoint"];
          const pos: Record<string, [number, number]> = {};
          types.forEach((t, ci) =>
            g.nodes
              .filter((n: any) => n.type === t)
              .forEach((n: any, i: number) => {
                pos[n.id] = [60 + ci * 175, 30 + i * 30];
              })
          );
          const h = 60 + Math.max(...types.map(t => g.nodes.filter((n: any) => n.type === t).length)) * 30;
          return (
            <div className="overflow-x-auto p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <svg width={1130} height={h}>
                {g.edges.map(
                  (e: any, i: number) =>
                    pos[e.source] &&
                    pos[e.target] && (
                      <line
                        key={i}
                        x1={pos[e.source][0]}
                        y1={pos[e.source][1]}
                        x2={pos[e.target][0]}
                        y2={pos[e.target][1]}
                        stroke="#334155"
                        strokeWidth={0.8}
                      />
                    )
                )}
                {g.nodes.map((n: any) => (
                  <g key={n.id}>
                    <circle cx={pos[n.id][0]} cy={pos[n.id][1]} r={6} fill={n.findings ? "#ef4444" : "#06b6d4"} />
                    <text x={pos[n.id][0] + 9} y={pos[n.id][1] + 4} fontSize={10} fill="#cbd5e1" fontFamily="monospace">
                      {n.label.slice(0, 26)}
                    </text>
                  </g>
                ))}
                {types.map((t, i) => (
                  <text key={t} x={50 + i * 175} y={12} fontSize={11} fill="#94a3b8" fontWeight="bold" textAnchor="start">
                    {t.toUpperCase()}
                  </text>
                ))}
              </svg>
              <div className="text-xs text-slate-400 mt-3 flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Red nodes: Open verified vulnerability</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Cyan nodes: Verified secure entity</span>
              </div>
            </div>
          );
        }}
      </Async>
    </Card>
  );
};

export const Retesting = () => {
  const q = useGet<any[]>("/api/retests");
  const act = useAct();
  return (
    <Card
      title="Empirical Retesting & Verification Console"
      subtitle="Verifies developer fixes against secured synthetic target builds"
      right={
        <Btn onClick={() => confirm("Retest all open findings?") && act("Retest All", () => api("/api/retest-all", { method: "POST" }), r => `${Object.values(r).filter(v => v === "Resolved").length} findings verified as Resolved`)}>
          <RefreshCw size={14} /> Retest All Open Findings
        </Btn>
      }
    >
      <Async q={q} emptyText="No retests recorded yet. Run a scan cycle, then trigger retests from Findings.">
        {d => (
          <Table
            cols={[
              { key: "ts", label: "Retest Timestamp", render: r => <span className="font-mono text-slate-400">{r.ts?.slice(0, 19)}</span> },
              { key: "finding_id", label: "Finding Identifier", render: r => <span className="font-mono text-cyan-300 font-semibold">{r.finding_id}</span> },
              { key: "reproduced", label: "Still Reproducible", render: r => (r.reproduced ? <span className="text-red-400 font-bold">Yes (Reopened)</span> : <span className="text-emerald-400 font-bold">No (Resolved)</span>) },
              { key: "final_status", label: "Final Status", render: r => <Badge v={r.final_status} /> }
            ]}
            rows={d}
          />
        )}
      </Async>
    </Card>
  );
};

export function Settings() {
  const q = useGet<any>("/api/settings");
  const me = useGet<any>("/api/me");
  const roles = useGet<any>("/api/roles");
  const act = useAct();
  const [v, setV] = useState<Record<string, any>>({});
  const num = ["window_days", "max_rps", "max_requests", "scan_interval_minutes"];

  return (
    <div className="space-y-4">
      <Card title="Platform Safety Policies & Configuration (Admin Only)" subtitle="Controls request throttling, target scopes, and background scheduler">
        <Async q={q}>
          {d => (
            <div className="space-y-3 text-xs">
              {num.map(k => (
                <div key={k} className="flex flex-wrap gap-2 items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <label className="font-medium text-slate-300 w-64">{k}{k === "scan_interval_minutes" ? " (0 = manual trigger only)" : ""}</label>
                  <div className="flex items-center gap-2">
                    <input className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 w-32 font-mono" defaultValue={d[k]} onChange={e => setV({ ...v, [k]: e.target.value })} />
                    <Btn tone="gray" size="sm" onClick={() => act("Save Setting", () => api(`/api/settings/${k}`, { method: "PUT", body: { value: Number(v[k] ?? d[k]) } }))}>Save</Btn>
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap gap-2 items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <label className="font-medium text-slate-300 w-64">Allowed Target Hosts (comma separated)</label>
                <div className="flex items-center gap-2">
                  <input className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 w-72 font-mono" defaultValue={d.allowed_hosts?.join(",")} onChange={e => setV({ ...v, hosts: e.target.value })} />
                  <Btn tone="gray" size="sm" onClick={() => act("Save Hosts", () => api("/api/settings/allowed_hosts", { method: "PUT", body: { value: String(v.hosts ?? d.allowed_hosts?.join(",")).split(",").map((h: string) => h.trim()).filter(Boolean) } }))}>Save</Btn>
                </div>
              </div>
            </div>
          )}
        </Async>
      </Card>

      <Card title="RBAC Role Matrix" subtitle="Capabilities per platform user role">
        <Async q={roles}>
          {(r: any) => (
            <div className="grid md:grid-cols-4 gap-3 text-xs">
              {Object.entries(r).map(([k, caps]) => (
                <div key={k} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <Badge v={k} />
                  <ul className="list-disc ml-4 space-y-1 text-slate-400 text-[11px]">
                    {(caps as string[]).map(c => <li key={c}>{c}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Async>
      </Card>

      {me.data?.role === "admin" ? <Users /> : (
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-xs text-slate-400">
          User management and credential controls are restricted to administrators.
        </div>
      )}
    </div>
  );
}

export function Users() {
  const u = useGet<any[]>("/api/users");
  const act = useAct();
  const [n, setN] = useState({ username: "", password: "", role: "viewer" });

  return (
    <Card title="Platform User Management" subtitle="Create and configure roles for security platform users">
      <Async q={u}>
        {d => (
          <Table
            pageSize={6}
            cols={[
              { key: "username", label: "Username", render: r => <span className="font-semibold text-slate-200">{r.username}</span> },
              {
                key: "role",
                label: "Role",
                render: r => (
                  <select
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200"
                    value={r.role}
                    onChange={e => act("Change Role", () => api(`/api/users/${r.username}`, { method: "PATCH", body: { role: e.target.value } }))}
                  >
                    {["viewer", "developer", "analyst", "admin"].map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                )
              }
            ]}
            rows={d}
          />
        )}
      </Async>

      <div className="mt-4 p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
        <h4 className="text-xs font-semibold text-slate-200">Create New Platform User</h4>
        <div className="flex flex-wrap gap-2 text-xs">
          <input placeholder="username" className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200" value={n.username} onChange={e => setN({ ...n, username: e.target.value })} />
          <input placeholder="password (10+ chars, letters+digits)" type="password" className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 w-64" value={n.password} onChange={e => setN({ ...n, password: e.target.value })} />
          <select className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200" value={n.role} onChange={e => setN({ ...n, role: e.target.value })}>
            {["viewer", "developer", "analyst", "admin"].map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <Btn onClick={() => act("Create user", () => api("/api/users", { method: "POST", body: n }), () => "Create user done")}>
            <UserCheck size={14} /> Add user
          </Btn>
        </div>
      </div>
    </Card>
  );
}
