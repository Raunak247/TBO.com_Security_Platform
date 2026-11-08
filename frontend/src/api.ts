let token: string | null = sessionStorage.getItem("ts_token");
export const setToken = (t: string | null) => { token = t; t ? sessionStorage.setItem("ts_token", t) : sessionStorage.removeItem("ts_token"); };
export const hasToken = () => !!token;
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(path, { method: opts.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  if (r.status === 401 && token) { setToken(null); location.reload(); }
  if (!r.ok) { let d = ""; try { d = (await r.json()).detail; } catch {} throw new Error(d || `HTTP ${r.status}`); }
  return r.json();
}
export async function download(fmt: string) {
  const r = await fetch(`/api/reports/${fmt}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob());
  a.download = fmt === "pdf" ? "executive_report.pdf" : `findings.${fmt}`; a.click();
}
