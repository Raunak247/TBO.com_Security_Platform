import { useState, ReactNode, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { Loader2, AlertCircle, CheckCircle2, ShieldAlert, Clock, ChevronRight, Search, ChevronLeft } from "lucide-react";

export const sevColor: Record<string, string> = {
  critical: "bg-red-500/15 text-red-300 border-red-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-sky-500/15 text-sky-300 border-sky-500/30"
};

export const methodColor: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  PATCH: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  DELETE: "bg-red-500/15 text-red-300 border-red-500/30"
};

export const Badge = ({ v, size = "sm" }: { v: string | number; size?: "xs" | "sm" | "md" }) => {
  const s = String(v);
  const c = sevColor[s] ?? methodColor[s] ?? ({
    Verified: "bg-red-500/15 text-red-300 border-red-500/30",
    Resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    Reopened: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    Assigned: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    "In Progress": "bg-amber-500/15 text-amber-300 border-amber-500/30",
    Fixed: "bg-teal-500/15 text-teal-300 border-teal-500/30",
    Retesting: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    "False Positive": "bg-slate-500/20 text-slate-400 border-slate-600/30",
    "Needs Review": "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    New: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    zombie: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    shadow: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
    new: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    P1: "bg-red-500/20 text-red-300 border-red-500/40 font-bold",
    P2: "bg-orange-500/20 text-orange-300 border-orange-500/40 font-bold",
    P3: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40 font-bold",
    blocked: "bg-red-500/20 text-red-300 border-red-500/30",
    allowed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    running: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse",
    completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    failed: "bg-red-500/20 text-red-300 border-red-500/30",
    stopped: "bg-red-500/20 text-red-300 border-red-500/30",
    admin: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    analyst: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    developer: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    viewer: "bg-slate-500/20 text-slate-300 border-slate-500/40",
    ACTIVE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    CONFIGURED: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    "ARCHITECTURAL STUB": "bg-slate-600/20 text-slate-400 border-slate-600/30",
    "Not Configured": "bg-slate-600/20 text-slate-400 border-slate-600/30"
  } as Record<string, string>)[s] ?? "bg-slate-800 text-slate-300 border-slate-700/50";

  const sz = size === "xs" ? "px-1.5 py-0.2 text-[10px]" : size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-medium whitespace-nowrap tracking-wide uppercase ${sz} ${c}`}>
      {s === "running" && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />}
      {s === "Verified" && <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />}
      {s === "Resolved" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
      {s}
    </span>
  );
};

export const Card = ({
  title,
  subtitle,
  children,
  right,
  className = ""
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) => (
  <div className={`rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm p-4.5 shadow-sm transition-all hover:border-slate-750 ${className}`}>
    {(title || right) && (
      <div className="flex flex-wrap justify-between items-start gap-2 mb-3.5 pb-2.5 border-b border-slate-800/60">
        <div>
          {typeof title === "string" ? <h3 className="text-sm font-semibold text-slate-200 tracking-wide">{title}</h3> : title}
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    )}
    {children}
  </div>
);

export const Metric = ({
  label,
  value,
  tone,
  icon: Icon,
  subtext
}: {
  label: string;
  value: ReactNode;
  tone?: string;
  icon?: any;
  subtext?: string;
}) => (
  <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3.5 flex flex-col justify-between transition-all hover:border-slate-700/80 hover:bg-slate-900/80">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">{label}</span>
      {Icon && <Icon size={16} className="text-slate-500" />}
    </div>
    <div className={`text-2xl font-bold tracking-tight mt-1 font-mono ${tone ?? "text-cyan-300"}`}>{value}</div>
    {subtext && <div className="text-[11px] text-slate-400 mt-1">{subtext}</div>}
  </div>
);

export const Btn = ({
  children,
  onClick,
  tone = "blue",
  size = "md",
  disabled,
  icon: Icon,
  title
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "blue" | "red" | "gray" | "emerald" | "outline";
  size?: "xs" | "sm" | "md";
  disabled?: boolean;
  icon?: any;
  title?: string;
}) => {
  const tClass =
    tone === "red"
      ? "bg-red-600/90 hover:bg-red-500 text-white shadow-sm border border-red-500/40"
      : tone === "emerald"
      ? "bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-sm border border-emerald-500/40"
      : tone === "gray"
      ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60"
      : tone === "outline"
      ? "bg-transparent hover:bg-slate-800/60 text-slate-300 border border-slate-700"
      : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm border border-cyan-500/50 shadow-cyan-950/50";

  const sClass = size === "xs" ? "px-2 py-0.5 text-[11px]" : size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm";
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${sClass} ${tClass}`}
    >
      {Icon && <Icon size={size === "sm" ? 13 : 15} />}
      {children}
    </button>
  );
};

export const Skeleton = () => (
  <div className="animate-pulse space-y-3">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="h-9 rounded-lg bg-slate-800/60 border border-slate-800/40" />
    ))}
  </div>
);

const ToastCtx = createContext<(m: string, bad?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ m: string; bad?: boolean } | null>(null);
  return (
    <ToastCtx.Provider
      value={(m, bad) => {
        setT({ m, bad });
        setTimeout(() => setT(null), 4500);
      }}
    >
      {children}
      {t && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border animate-in slide-in-from-bottom-3 duration-200 ${
            t.bad
              ? "bg-red-950/95 text-red-200 border-red-700/60 shadow-red-950/50"
              : "bg-slate-900/95 text-emerald-300 border-emerald-600/50 shadow-emerald-950/50"
          }`}
        >
          {t.bad ? <AlertCircle size={18} className="text-red-400" /> : <CheckCircle2 size={18} className="text-emerald-400" />}
          <span>{t.m}</span>
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function useGet<T = any>(key: string, refetch?: number) {
  return useQuery<T>({ queryKey: [key], queryFn: () => api<T>(key), refetchInterval: refetch });
}

export function Async<T>({
  q,
  children,
  emptyText
}: {
  q: { data?: T; isLoading: boolean; error: unknown };
  children: (d: T) => ReactNode;
  emptyText?: string;
}) {
  if (q.isLoading) return <Skeleton />;
  if (q.error)
    return (
      <div className="p-4 rounded-xl border border-red-900/50 bg-red-950/30 text-red-300 text-sm flex items-center gap-2">
        <AlertCircle size={16} />
        <span>Error: {(q.error as Error).message}</span>
      </div>
    );
  const d = q.data as any;
  if (Array.isArray(d) && d.length === 0)
    return (
      <div className="text-slate-400 text-sm p-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
        <div className="text-slate-500 mb-1">No records available</div>
        <div className="text-xs text-slate-600">{emptyText ?? "Trigger an autonomous cycle or scan to populate telemetry."}</div>
      </div>
    );
  return <>{children(q.data as T)}</>;
}

export type Col = { key: string; label: string; render?: (r: any) => ReactNode };
export function Table({
  cols,
  rows,
  onRow,
  pageSize = 10,
  searchPlaceholder = "Filter records..."
}: {
  cols: Col[];
  rows: any[];
  onRow?: (r: any) => void;
  pageSize?: number;
  searchPlaceholder?: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<string | null>(null);
  const [asc, setAsc] = useState(true);
  const [pg, setPg] = useState(0);

  let r = rows.filter(x => !q || JSON.stringify(x).toLowerCase().includes(q.toLowerCase()));
  if (sort) r = [...r].sort((a, b) => (a[sort] > b[sort] ? 1 : -1) * (asc ? 1 : -1));
  const pages = Math.max(1, Math.ceil(r.length / pageSize));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setPg(0);
            }}
            placeholder={searchPlaceholder}
            className="w-72 rounded-lg bg-slate-950/80 border border-slate-800 pl-8.5 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
          />
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {r.length} {r.length === 1 ? "record" : "records"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-950/40">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-800/80 bg-slate-900/60">
              {cols.map(c => (
                <th
                  key={c.key}
                  className="py-2.5 px-3.5 font-semibold cursor-pointer select-none tracking-wider text-[11px] uppercase hover:text-slate-200"
                  onClick={() => {
                    setAsc(sort === c.key ? !asc : true);
                    setSort(c.key);
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort === c.key ? (asc ? " ▲" : " ▼") : ""}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {r.slice(pg * pageSize, (pg + 1) * pageSize).map((x, i) => (
              <tr
                key={i}
                onClick={() => onRow?.(x)}
                className={`transition-colors ${
                  onRow ? "cursor-pointer hover:bg-slate-800/50" : "hover:bg-slate-900/30"
                }`}
              >
                {cols.map(c => (
                  <td key={c.key} className="py-2.5 px-3.5 align-middle text-slate-300">
                    {c.render ? c.render(x) : String(x[c.key] ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
            {r.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="text-center py-6 text-slate-500">
                  No matching results found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>
            Page {pg + 1} of {pages}
          </span>
          <div className="flex items-center gap-1.5">
            <Btn tone="gray" size="sm" disabled={pg === 0} onClick={() => setPg(pg - 1)}>
              <ChevronLeft size={13} /> Prev
            </Btn>
            <Btn tone="gray" size="sm" disabled={pg + 1 >= pages} onClick={() => setPg(pg + 1)}>
              Next <ChevronRight size={13} />
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

export const Drawer = ({ onClose, title, children }: { onClose: () => void; title?: string; children: ReactNode }) => (
  <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
    <div
      className="w-full max-w-2xl h-full overflow-y-auto bg-slate-950 border-l border-slate-800 p-6 shadow-2xl flex flex-col justify-between"
      onClick={e => e.stopPropagation()}
    >
      <div>
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-200 tracking-tight">{title ?? "Inspector"}</h2>
          <button
            className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 text-xs transition-colors cursor-pointer"
            onClick={onClose}
          >
            Close ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  </div>
);

export const TargetNotice = () => (
  <div className="px-4 py-1.5 bg-cyan-950/40 border-b border-cyan-800/40 text-[11px] text-cyan-300 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
      <span className="font-semibold tracking-wide uppercase">Synthetic Demo Sandbox:</span>
      <span className="text-cyan-200/80">Local B2B Travel Aggregator Target (simulated agencies: Sunrise Travels & Global Holidays)</span>
    </div>
    <span className="text-slate-400 font-mono text-[10px]">ISOLATED ASGI TRANSPORT — NO EXTERNAL NETWORK CALLS</span>
  </div>
);
