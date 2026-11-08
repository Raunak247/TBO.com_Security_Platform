import { useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  Activity, Boxes, Bug, FileText, GitCompare, Globe, KeyRound,
  Layers, Network, Play, Plug, ScrollText, Search, Settings as Cog,
  ShieldCheck, Skull, Target, Workflow, Radar, Gauge, Bell, Zap,
  Menu, Users as UsersIcon, LogOut, CheckCircle2, Lock, AlertTriangle, Shield
} from "lucide-react";
import { api, hasToken, setToken } from "./api";
import { ToastHost, useGet, Badge, TargetNotice } from "./ui";
import * as P from "./pages";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  element: JSX.Element;
  roles?: string[];
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

function RefreshCwIcon(props: any) {
  return <Search {...props} />;
}

export const ALL_ROUTES: { path: string; element: JSX.Element }[] = [
  { path: "/", element: <P.Overview /> },
  { path: "/scans", element: <P.Scans /> },
  { path: "/changes", element: <P.Changes /> },
  { path: "/inventory", element: <P.Inventory /> },
  { path: "/vulns", element: <P.Vulns /> },
  { path: "/reports", element: <P.Reports /> },
  { path: "/retest", element: <P.Retesting /> },
  { path: "/agents", element: <P.Agents /> },
  { path: "/automation", element: <P.Scans /> },
  { path: "/ecosystem", element: <P.Ecosystem /> },
  { path: "/discovery", element: <P.Inventory discovery /> },
  { path: "/lifecycle", element: <P.Lifecycle /> },
  { path: "/planner", element: <P.Planner /> },
  { path: "/graph", element: <P.Graph /> },
  { path: "/verification", element: <P.Vulns mode="verification" /> },
  { path: "/risk", element: <P.Vulns mode="risk" /> },
  { path: "/audit", element: <P.Audit /> },
  { path: "/scenarios", element: <P.Scenarios /> },
  { path: "/applications", element: <P.Applications /> },
  { path: "/integrations", element: <P.Integrations /> },
  { path: "/users", element: <P.Users /> },
  { path: "/settings", element: <P.Settings /> },
];

export function getNavGroups(role: string): NavGroup[] {
  if (role === "developer") {
    return [
      {
        name: "DEVELOPER WORKSPACE",
        items: [
          { to: "/", label: "Remediation Queue", icon: Gauge, element: <P.Overview /> },
          { to: "/vulns", label: "Vulnerabilities", icon: Bug, element: <P.Vulns /> },
          { to: "/retest", label: "Retesting", icon: RefreshCwIcon, element: <P.Retesting /> }
        ]
      },
      {
        name: "API CONTEXT",
        items: [
          { to: "/inventory", label: "API Inventory", icon: Layers, element: <P.Inventory /> },
          { to: "/changes", label: "Change Intelligence", icon: GitCompare, element: <P.Changes /> },
          { to: "/reports", label: "Reports", icon: FileText, element: <P.Reports /> }
        ]
      }
    ];
  }

  if (role === "admin") {
    return [
      {
        name: "PLATFORM ADMINISTRATION",
        items: [
          { to: "/", label: "System Health", icon: Gauge, element: <P.Overview /> },
          { to: "/users", label: "User Management", icon: UsersIcon, element: <P.Users /> },
          { to: "/applications", label: "Applications", icon: Boxes, element: <P.Applications /> },
          { to: "/integrations", label: "Integrations", icon: Plug, element: <P.Integrations /> },
          { to: "/settings", label: "Settings", icon: Cog, element: <P.Settings /> }
        ]
      },
      {
        name: "GOVERNANCE & POLICY",
        items: [
          { to: "/audit", label: "Audit Logs", icon: ScrollText, element: <P.Audit /> },
          { to: "/scans", label: "Security Scans", icon: Activity, element: <P.Scans /> },
          { to: "/discovery", label: "Discovery", icon: Radar, element: <P.Inventory discovery /> },
          { to: "/inventory", label: "API Inventory", icon: Layers, element: <P.Inventory /> },
          { to: "/changes", label: "Change Intelligence", icon: GitCompare, element: <P.Changes /> }
        ]
      }
    ];
  }

  if (role === "viewer") {
    return [
      {
        name: "EXECUTIVE OVERSIGHT",
        items: [
          { to: "/", label: "Executive Posture", icon: Gauge, element: <P.Overview /> },
          { to: "/vulns", label: "Vulnerabilities", icon: Bug, element: <P.Vulns /> },
          { to: "/ecosystem", label: "Travel Ecosystem", icon: UsersIcon, element: <P.Ecosystem /> }
        ]
      },
      {
        name: "COMPLIANCE & AUDIT",
        items: [
          { to: "/reports", label: "Reports", icon: FileText, element: <P.Reports /> },
          { to: "/audit", label: "Audit Logs", icon: ScrollText, element: <P.Audit /> },
          { to: "/inventory", label: "API Inventory", icon: Layers, element: <P.Inventory /> },
          { to: "/lifecycle", label: "Zombie & Shadow APIs", icon: Skull, element: <P.Lifecycle /> },
          { to: "/graph", label: "Business Knowledge Graph", icon: Network, element: <P.Graph /> }
        ]
      }
    ];
  }

  // Default: Analyst gets the full suite
  return [
    {
      name: "CORE OPERATIONS",
      items: [
        { to: "/", label: "Overview", icon: Gauge, element: <P.Overview /> },
        { to: "/scans", label: "Security Scans", icon: Activity, element: <P.Scans /> },
        { to: "/changes", label: "Change Intelligence", icon: GitCompare, element: <P.Changes /> },
        { to: "/inventory", label: "API Inventory", icon: Layers, element: <P.Inventory /> },
        { to: "/vulns", label: "Vulnerabilities", icon: Bug, element: <P.Vulns /> },
        { to: "/reports", label: "Reports", icon: FileText, element: <P.Reports /> },
        { to: "/retest", label: "Retesting", icon: RefreshCwIcon, element: <P.Retesting /> }
      ]
    },
    {
      name: "ADVANCED INTELLIGENCE",
      items: [
        { to: "/agents", label: "Agents", icon: Globe, element: <P.Agents /> },
        { to: "/automation", label: "Workflow Intelligence", icon: Zap, element: <P.Scans /> },
        { to: "/ecosystem", label: "Travel Ecosystem", icon: UsersIcon, element: <P.Ecosystem /> },
        { to: "/discovery", label: "Discovery", icon: Radar, element: <P.Inventory discovery /> },
        { to: "/lifecycle", label: "Zombie & Shadow APIs", icon: Skull, element: <P.Lifecycle /> },
        { to: "/planner", label: "Attack Planner", icon: Target, element: <P.Planner /> },
        { to: "/graph", label: "Business Knowledge Graph", icon: Network, element: <P.Graph /> },
        { to: "/verification", label: "Verification", icon: ShieldCheck, element: <P.Vulns mode="verification" /> },
        { to: "/risk", label: "Risk Intelligence", icon: Workflow, element: <P.Vulns mode="risk" /> },
        { to: "/audit", label: "Audit Logs", icon: ScrollText, element: <P.Audit /> },
        { to: "/scenarios", label: "Demo Scenarios", icon: Play, element: <P.Scenarios /> }
      ]
    },
    {
      name: "ADMINISTRATION",
      items: [
        { to: "/applications", label: "Applications", icon: Boxes, element: <P.Applications /> },
        { to: "/integrations", label: "Integrations", icon: Plug, element: <P.Integrations /> },
        { to: "/users", label: "User Management", icon: UsersIcon, element: <P.Users /> },
        { to: "/settings", label: "Settings", icon: Cog, element: <P.Settings /> }
      ]
    }
  ];
}

function Login({ done }: { done: () => void }) {
  const [u, setU] = useState("analyst");
  const [p, setP] = useState("Analyst#2026demo");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const fillRole = (username: string, pass: string) => {
    setU(username);
    setP(pass);
    setErr("");
  };

  async function go() {
    setLoading(true);
    setErr("");
    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: { username: u, password: p }
      });
      setToken(res.token);
      done();
    } catch (e) {
      setErr("Authentication failed. Ensure credentials match demo platform users.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[#070b14] p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Brand header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 mb-2 shadow-lg shadow-cyan-950/50">
            <Shield size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center justify-center gap-1.5">
            <span>TravelShield</span>
            <span className="text-cyan-400">AI</span>
          </h1>
          <p className="text-xs text-slate-400">Autonomous DAST Platform for B2B Travel APIs</p>
        </div>

        {/* Login Card */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-md shadow-2xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-200">Platform Sign-In</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Enter credentials or choose a pre-configured role below</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Username</label>
              <input
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                value={u}
                onChange={e => setU(e.target.value)}
                placeholder="username"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Password</label>
              <input
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                type="password"
                value={p}
                onChange={e => setP(e.target.value)}
                placeholder="password"
                onKeyDown={e => e.key === "Enter" && go()}
              />
            </div>

            {err && (
              <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0 text-red-400" />
                <span>{err}</span>
              </div>
            )}

            <button
              disabled={loading}
              onClick={go}
              className="w-full mt-1 bg-cyan-600 hover:bg-cyan-500 active:scale-[0.99] text-white font-medium py-2 px-4 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-cyan-950/50 disabled:opacity-50"
            >
              <KeyRound size={14} />
              {loading ? "Authenticating..." : "Sign in"}
            </button>
          </div>

          {/* Quick-fill Demo Roles */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">
              Quick Role Switcher (Demo Identities)
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => fillRole("analyst", "Analyst#2026demo")}
                className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                  u === "analyst" ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-200" : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="font-semibold text-slate-200 flex items-center justify-between">
                  <span>Analyst</span>
                  <Badge v="analyst" size="xs" />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">Full SOC & Scan Controls</div>
              </button>

              <button
                type="button"
                onClick={() => fillRole("dev", "Dev#2026demo")}
                className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                  u === "dev" ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-200" : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="font-semibold text-slate-200 flex items-center justify-between">
                  <span>Developer</span>
                  <Badge v="developer" size="xs" />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">Remediation Workspace</div>
              </button>

              <button
                type="button"
                onClick={() => fillRole("admin", "Admin#2026demo")}
                className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                  u === "admin" ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-200" : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="font-semibold text-slate-200 flex items-center justify-between">
                  <span>Admin</span>
                  <Badge v="admin" size="xs" />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">Users & Safety Policy</div>
              </button>

              <button
                type="button"
                onClick={() => fillRole("viewer", "Viewer#2026demo")}
                className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                  u === "viewer" ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-200" : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="font-semibold text-slate-200 flex items-center justify-between">
                  <span>Viewer</span>
                  <Badge v="viewer" size="xs" />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">Executive Read-Only</div>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500">
          Target Environment: Synthetic B2B Travel Platform (Isolated Sandbox)
        </div>
      </div>
    </div>
  );
}

function TopNav() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any>(null);
  const [openNotes, setOpenNotes] = useState(false);
  const me = useGet<any>("/api/me", 20000);
  const notes = useGet<any[]>("/api/notifications", 15000);

  const goSearch = async (v: string) => {
    setQ(v);
    if (v.length < 2) return setRes(null);
    try {
      setRes(await api(`/api/search?q=${encodeURIComponent(v)}`));
    } catch {
      setRes(null);
    }
  };

  const switchRole = async (username: string, pass: string) => {
    try {
      const r = await api("/api/auth/login", {
        method: "POST",
        body: { username, password: pass }
      });
      setToken(r.token);
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Target status identifier */}
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-semibold text-slate-200">Target:</span>
          <span className="font-mono text-cyan-300">synthetic-travel.local</span>
        </div>
        <span className="text-slate-600">|</span>
        <span className="hidden lg:inline text-slate-400">Environment: <b className="text-slate-200 font-normal">local-demo</b></span>
      </div>

      {/* Quick Role Switcher for live hackathon demonstration */}
      <div className="hidden md:flex items-center gap-1 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800 text-xs">
        <span className="text-[10px] uppercase font-semibold text-slate-500 mr-1">Persona:</span>
        {[
          { role: "analyst", user: "analyst", pass: "Analyst#2026demo", label: "Analyst" },
          { role: "developer", user: "dev", pass: "Dev#2026demo", label: "Developer" },
          { role: "admin", user: "admin", pass: "Admin#2026demo", label: "Admin" },
          { role: "viewer", user: "viewer", pass: "Viewer#2026demo", label: "Viewer" }
        ].map(item => {
          const active = me.data?.role === item.role;
          return (
            <button
              key={item.role}
              onClick={() => !active && switchRole(item.user, item.pass)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                active
                  ? "bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
              title={`Switch persona to ${item.label}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Global Search and User Profile */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            value={q}
            onChange={e => goSearch(e.target.value)}
            placeholder="Search findings and endpoints..."
            className="w-48 lg:w-64 rounded-lg bg-slate-900 border border-slate-800 pl-8.5 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/70"
          />

          {res && (
            <div className="absolute top-10 right-0 w-80 lg:w-96 z-40 rounded-xl border border-slate-700 bg-slate-950 p-2 text-xs shadow-2xl">
              <div className="text-[10px] uppercase font-bold text-slate-500 px-2 py-1">Findings</div>
              {res.findings.map((f: any) => (
                <div
                  key={f.id}
                  className="cursor-pointer hover:bg-slate-900 p-2 rounded-lg transition-colors flex items-center justify-between"
                  onClick={() => {
                    nav("/vulns");
                    setRes(null);
                    setQ("");
                  }}
                >
                  <span className="font-mono text-cyan-300 font-semibold">{f.id}</span>
                  <span className="text-slate-300 truncate max-w-[200px]">{f.title}</span>
                  <Badge v={f.status} size="xs" />
                </div>
              ))}

              <div className="text-[10px] uppercase font-bold text-slate-500 px-2 py-1 mt-1 border-t border-slate-800">Endpoints</div>
              {res.endpoints.map((e: any) => (
                <div
                  key={e.key}
                  className="cursor-pointer hover:bg-slate-900 p-2 rounded-lg transition-colors flex items-center justify-between"
                  onClick={() => {
                    nav("/inventory");
                    setRes(null);
                    setQ("");
                  }}
                >
                  <span className="font-mono text-slate-200">{e.key}</span>
                  <Badge v={e.lifecycle} size="xs" />
                </div>
              ))}

              {!res.findings.length && !res.endpoints.length && (
                <div className="text-slate-500 p-3 text-center">No matching entities found</div>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setOpenNotes(!openNotes)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell size={15} />
            {!!notes.data?.length && (
              <span className="absolute -top-1 -right-1 text-[9px] bg-red-500 text-white font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {notes.data.length}
              </span>
            )}
          </button>

          {openNotes && (
            <div className="absolute top-11 right-0 w-80 z-40 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs shadow-2xl space-y-2">
              <div className="font-semibold text-slate-200 pb-1 border-b border-slate-800 flex justify-between items-center">
                <span>Security Notifications</span>
                <span className="text-[10px] text-slate-500">{notes.data?.length ?? 0} active</span>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {notes.data?.length ? (
                  notes.data.map((n: any, i: number) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800 cursor-pointer transition-colors"
                      onClick={() => {
                        nav(n.to);
                        setOpenNotes(false);
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Badge v={n.level} size="xs" />
                        <span className="text-slate-200 font-medium">{n.text}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 py-3 text-center">No alerts requiring attention</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Pill */}
        {me.data && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-200">{me.data.username}</div>
              <div className="text-[10px] text-slate-500 capitalize">{me.data.role}</div>
            </div>
            <Badge v={me.data.role} size="sm" />
            <button
              onClick={() => {
                setToken(null);
                location.reload();
              }}
              title="Sign Out"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-900/50 transition-colors cursor-pointer"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function Shell() {
  const me = useGet<any>("/api/me", 20000);
  const [collapsed, setCollapsed] = useState(false);
  const role = me.data?.role ?? "viewer";
  const navGroups = getNavGroups(role);

  return (
    <div className="flex min-h-screen bg-[#070b14] text-slate-200">
      {/* Left Sidebar */}
      <aside
        className={`shrink-0 border-r border-slate-800/80 bg-slate-950 flex flex-col justify-between transition-all duration-200 sticky top-0 h-screen z-40 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div>
          {/* Logo / Header */}
          <div className="h-14 border-b border-slate-800/80 px-4 flex items-center justify-between">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                  <Shield size={16} />
                </div>
                <div className="font-bold text-sm tracking-wide text-slate-100 flex items-center">
                  <span>TravelShield</span>
                  <span className="text-cyan-400">AI</span>
                </div>
              </div>
            )}
            {collapsed && (
              <div className="p-1 mx-auto rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                <Shield size={18} />
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-900 transition-colors cursor-pointer"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu size={16} />
            </button>
          </div>

          {/* Navigation Groups */}
          <nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
            {navGroups.map(grp => (
              <div key={grp.name} className="space-y-1">
                {!collapsed && (
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1">
                    {grp.name}
                  </div>
                )}
                {grp.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 font-semibold"
                          : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                      } ${collapsed ? "justify-center px-0" : ""}`
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={15} className="shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950">
          {!collapsed ? (
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">Safety Guardian</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Scope: Allowlist active</div>
            </div>
          ) : (
            <div className="flex justify-center" title="Safety Guardian Active">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TargetNotice />
        <TopNav />
        <main className="flex-1 p-6 overflow-y-auto">
          <Routes>
            {ALL_ROUTES.map(item => (
              <Route key={item.path} path={item.path} element={item.element} />
            ))}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [ok, setOk] = useState(hasToken());
  return <ToastHost>{ok ? <Shell /> : <Login done={() => setOk(true)} />}</ToastHost>;
}
