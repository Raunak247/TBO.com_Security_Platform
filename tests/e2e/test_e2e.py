"""Browser E2E: real API + real UI. Run: python -m pytest tests/e2e (needs `npm run build` deps and playwright chromium)."""
import os, pathlib, shutil, subprocess, sys, time, urllib.request
import pytest
pw = pytest.importorskip("playwright.sync_api")
from travelshield.browser_discovery import available
if not available():
    pytest.skip("Chromium for Playwright not installed: python -m playwright install chromium", allow_module_level=True)
ROOT = pathlib.Path(__file__).resolve().parents[2]


def wait(url):
    for _ in range(60):
        try: urllib.request.urlopen(url, timeout=1); return
        except Exception: time.sleep(0.5)
    raise RuntimeError(url)


def _kill(proc):
    if not proc:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        try:
            proc.terminate()
        except Exception:
            pass


@pytest.fixture(scope="module")
def servers(tmp_path_factory):
    work = tmp_path_factory.mktemp("e2e")
    env = dict(os.environ, PYTHONPATH=str(ROOT))
    api = subprocess.Popen([sys.executable, "-m", "uvicorn", "travelshield.api:app", "--port", "8000"], cwd=work, env=env,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    npx_bin = shutil.which("npx") or "npx"
    ui = subprocess.Popen([npx_bin, "vite", "--host", "127.0.0.1", "--port", "5173", "--strictPort"], cwd=ROOT / "frontend",
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=(os.name == "nt"))
    try:
        wait("http://127.0.0.1:8000/docs"); wait("http://127.0.0.1:5173/")
        yield
    finally:
        _kill(api); _kill(ui)


def login(page, user, pw_):
    page.goto("http://127.0.0.1:5173/")
    page.fill("input[placeholder=username]", user); page.fill("input[placeholder=password]", pw_)
    page.click("text=Sign in >> nth=-1"); page.wait_for_selector("text=Environment:")


def test_analyst_flow(servers):
    with pw.sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_page(accept_downloads=True)
        login(page, "analyst", "Analyst#2026demo")
        page.click("text=Run full cycle"); page.wait_for_selector("text=18 findings", timeout=60000)
        page.click("text=Vulnerabilities >> nth=0"); page.click("tr >> nth=1")
        page.wait_for_selector("text=Evidence timeline")
        page.click("text=Start retest"); page.wait_for_selector("text=Retest result: Resolved")
        page.click("text=Close ✕"); page.click("text=Reports")
        with page.expect_download() as d: page.click("text=Export PDF")
        assert d.value.suggested_filename.endswith(".pdf")
        page.click("text=Demo Scenarios"); page.click("button:has-text('Run') >> nth=5")
        page.wait_for_selector("text=blocked: out_of_scope", timeout=20000)
        for label in ["Applications", "API Inventory", "Change Intelligence", "Zombie & Shadow APIs", "Business Knowledge Graph", "Attack Planner",
                      "Security Scans", "Verification", "Risk Intelligence", "Retesting", "Agents", "Integrations", "Audit Logs", "Settings"]:
            page.click(f"aside >> text={label}"); page.wait_for_timeout(600)
            assert page.locator("text=Error:").count() == 0, label
        b.close()


def test_viewer_cannot_run_scans(servers):
    with pw.sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_page()
        login(page, "viewer", "Viewer#2026demo")
        page.click("text=Run full cycle"); page.wait_for_selector("text=requires role analyst")
        b.close()


def test_admin_user_mgmt_search_and_browser_crawl(servers):
    with pw.sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_page()
        login(page, "admin", "Admin#2026demo")
        page.click("aside >> text=Discovery"); page.click("text=Run browser crawl")
        page.wait_for_selector("text=undocumented route(s) in frontend JS", timeout=60000)
        page.fill("input[placeholder^='Search findings']", "debug"); page.wait_for_selector("text=internal/debug/config")
        page.click("aside >> text=Settings")
        page.fill("input[placeholder=username]", "e2e.user"); page.fill("input[placeholder^='password']", "Str0ng#Pass99")
        page.click("text=Add user"); page.wait_for_selector("text=Create user done"); page.wait_for_selector("text=e2e.user")
        page.screenshot(path="/tmp/settings.png", full_page=True)
        b.close()
