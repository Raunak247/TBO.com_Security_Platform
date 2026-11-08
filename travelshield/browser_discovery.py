"""Browser discovery: Playwright crawls the synthetic UI on a loopback port and extracts API routes referenced in frontend JavaScript.
Every browser request is checked against the allowlist and audited; anything else is aborted."""
import contextlib, re, socket, threading, time
from urllib.parse import urlparse
from synthetic_travel_app.app import create_app
from .db import now, log_agent

ROUTE = re.compile(r"""["'`](/[A-Za-z0-9_\-./{}?=&]*[A-Za-z0-9_}])["'`]""")


@contextlib.contextmanager
def serve_target(version=2, secure=False):
    import uvicorn
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(create_app(version, secure), host="127.0.0.1", port=port, log_level="error"))
    t = threading.Thread(target=server.run, daemon=True); t.start()
    for _ in range(100):
        if server.started: break
        time.sleep(0.05)
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.should_exit = True; t.join(5)


def _norm(path):
    path = path.split("?")[0]
    return re.sub(r"/BK-\d+", "/{booking_id}", path)


class BrowserUnavailable(RuntimeError):
    pass


def available():
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            p.chromium.launch().close()
        return True
    except Exception:
        return False


def crawl(db, base, max_pages=12):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise BrowserUnavailable("playwright is not installed: pip install playwright") from e
    host = urlparse(base).netloc
    pages, scripts, blocked, queue = [], {}, [], ["/ui/"]

    def guard(route):
        u = urlparse(route.request.url)
        ok = u.netloc == host
        db.execute("INSERT INTO audit(ts,actor,test,method,url,decision,reason) VALUES(?,?,?,?,?,?,?)",
                   (now(), "browser-discovery-agent", "browser-crawl", route.request.method, route.request.url,
                    "allowed" if ok else "blocked", "" if ok else f"out_of_scope:{u.hostname}"))
        db.commit()
        if ok: route.continue_()
        else: blocked.append(route.request.url); route.abort()

    with sync_playwright() as p:
        try:
            b = p.chromium.launch()
        except Exception as e:
            raise BrowserUnavailable("Chromium for Playwright is missing: run `python -m playwright install chromium`") from e
        page = b.new_page(); page.route("**/*", guard)
        page.on("response", lambda r: scripts.__setitem__(r.url, r) if r.url.endswith(".js") else None)
        while queue and len(pages) < max_pages:
            path = queue.pop(0)
            if path in pages: continue
            page.goto(base + path); pages.append(path)
            for h in page.eval_on_selector_all("a", "els => els.map(e => e.getAttribute('href'))"):
                if h and h.startswith("/ui") and h not in pages: queue.append(h)
        refs = set()
        for r in scripts.values():
            refs |= {_norm(m) for m in ROUTE.findall(r.text())}
        b.close()
    return dict(pages=pages, routes=sorted(x for x in refs if not x.startswith(("/ui", "/static"))), blocked=blocked)
