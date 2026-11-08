"""SYNTHETIC B2B travel target. All data is fake. Never deploy this.

create_app(version=1|2, secure=False|True)
  secure=False -> deliberately vulnerable demo environment
  secure=True  -> fixed demo environment
The vulnerable logic lives only in this package, never in the TravelShield backend.
"""
from fastapi import FastAPI, HTTPException, Depends, Body, Query
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer
from pydantic import BaseModel
import html, re
from fastapi import Request
from fastapi.responses import RedirectResponse, Response

USERS = {  # name: (agency, role)
    "alice": ("A", "agency_admin"),
    "bob": ("B", "sub_agent"),
    "carol": ("B", "finance_operator"),
    "root": ("*", "super_admin"),
    "sessionprobe": ("A", "sub_agent"),
    "sessionprobe2": ("B", "sub_agent"),
}


class LoginIn(BaseModel):
    username: str
    password: str


class RefundV1(BaseModel):
    amount: float


class RefundV2(BaseModel):
    amount: float
    reason: str | None = None


class UploadIn(BaseModel):
    filename: str
    content_type: str
    size: int
    content: str


MOCK_INTERNAL = {"http://mock-internal.local/admin": "SYNTHETIC-INTERNAL-ADMIN-PAGE",
                 "http://mock-internal.local/metadata": "SYNTHETIC-INTERNAL-METADATA"}


class CouponIn(BaseModel):
    booking_id: str
    code: str


def seed_bookings():
    out = {}
    for agency, base in (("A", 1000), ("B", 2000)):
        for i in range(1, 4):
            bid = f"BK-{base + i}"
            fare = 400.0 + 50 * i
            out[bid] = dict(
                id=bid, agency=agency, passenger=f"Test Passenger {agency}{i}",
                passport=f"P{base + i:07d}", email=f"pax{base + i}@example.test",
                route="DEL-BOM", seat=f"{i}A", fare=fare, internal_cost=round(fare * 0.82, 2),
                status="CONFIRMED", refunded=False, coupons=[],
            )
    return out


def create_app(version: int = 1, secure: bool = False) -> FastAPI:
    app = FastAPI(title=f"Synthetic Travel Platform v{version} ({'fixed' if secure else 'vulnerable'})")
    bearer = HTTPBearer(auto_error=False)
    bookings = seed_bookings()
    revoked, fails = set(), {}

    def auth(creds):
        if not creds or not creds.credentials.startswith("tok-") or creds.credentials[4:] not in USERS:
            raise HTTPException(401, "authentication required")
        if secure and creds.credentials in revoked:
            raise HTTPException(401, "session revoked")
        name = creds.credentials[4:]
        return dict(name=name, agency=USERS[name][0], role=USERS[name][1])

    def get(bid):
        if bid not in bookings:
            raise HTTPException(404, "booking not found")
        return bookings[bid]

    def own(u, b):
        return u["agency"] in (b["agency"], "*")

    def view(b):
        d = dict(b)
        if secure:
            d.pop("internal_cost")
            d["passport"] = "*****" + d["passport"][-3:]
        return d

    @app.post("/auth/login")
    def login(body: LoginIn):
        if secure and fails.get(body.username, 0) >= 5:
            raise HTTPException(429, "too many attempts")
        if body.username in USERS and body.password == f"pw-{body.username}":
            return {"token": f"tok-{body.username}"}
        fails[body.username] = fails.get(body.username, 0) + 1
        raise HTTPException(401, "bad credentials")

    @app.post("/auth/logout")
    def logout(creds=Depends(bearer)):
        auth(creds)
        if secure:
            revoked.add(creds.credentials)
        return {"status": "logged out"}

    @app.get("/flights/search")
    def search(origin: str = Query(...), dest: str = Query(...)):
        if secure:
            if not (re.fullmatch(r"[A-Za-z]{3}", origin) and re.fullmatch(r"[A-Za-z]{3}", dest)):
                raise HTTPException(422, "invalid airport code")
        elif any(c in origin + dest for c in "'\""):
            raise HTTPException(500, "sqlite3.OperationalError: unrecognized token near quote")
        return {"results": [{"flight": "SY101", "origin": origin, "dest": dest, "fare": 250.0}]}

    @app.get("/bookings/{booking_id}")
    def booking(booking_id: str, creds=Depends(bearer)):
        u = auth(creds)
        if not secure and "'" in booking_id:
            raise HTTPException(500, "Traceback (most recent call last): File app/db.py, line 42, in find_booking SQLError near quote")
        b = get(booking_id)
        if secure and not own(u, b):
            raise HTTPException(404, "booking not found")
        return view(b)

    Refund = RefundV2 if version >= 2 else RefundV1

    @app.post("/bookings/{booking_id}/refund")
    def refund(booking_id: str, body: Refund, creds=Depends(bearer)):
        u, b = auth(creds), get(booking_id)
        if secure:
            if u["role"] not in ("finance_operator", "agency_admin", "super_admin") or not own(u, b):
                raise HTTPException(403, "not permitted")
            if b["refunded"] or body.amount > b["fare"]:
                raise HTTPException(409, "invalid refund")
        b["refunded"], b["status"] = True, "REFUNDED"
        return {"refund_id": f"RF-{booking_id}", "status": "REFUNDED", "amount": body.amount}

    @app.post("/coupons/apply")
    def coupon(body: CouponIn, creds=Depends(bearer)):
        u, b = auth(creds), get(body.booking_id)
        if secure and (not own(u, b) or body.code in b["coupons"]):
            raise HTTPException(409, "coupon not applicable")
        b["coupons"].append(body.code)
        b["fare"] = round(b["fare"] * 0.9, 2)
        return {"booking_id": b["id"], "fare": b["fare"]}

    @app.get("/api/v0/legacy/bookings")
    def legacy():
        if secure:
            return JSONResponse({"detail": "gone"}, status_code=410)
        return [{"id": b["id"], "email": b["email"]} for b in bookings.values()]

    @app.get("/api/internal/debug/config", include_in_schema=False)
    def debug():
        if secure:
            raise HTTPException(404, "not found")
        return {"db_url": "sqlite:///synthetic.db", "secret_key": "SYNTHETIC-NOT-A-REAL-SECRET"}  # nosec B105 - deliberate fake value in the demo target

    @app.post("/bookings/search")
    def bsearch(body: dict = Body(...), creds=Depends(bearer)):
        u = auth(creds)
        flt = body.get("agency", u["agency"])
        if secure:
            if not isinstance(flt, str):
                raise HTTPException(422, "operators not allowed")
            flt = u["agency"] if u["agency"] != "*" else flt
            return [dict(id=b["id"], agency=b["agency"]) for b in bookings.values() if b["agency"] == flt]
        if isinstance(flt, dict) and "$ne" in flt:  # simulated NoSQL operator handling
            return [dict(id=b["id"], agency=b["agency"]) for b in bookings.values() if b["agency"] != flt["$ne"]]
        return [dict(id=b["id"], agency=b["agency"]) for b in bookings.values() if b["agency"] == flt]

    @app.get("/agency/greeting")
    def greeting(name: str = Query(...)):
        m = re.fullmatch(r"\{\{(\d+)\*(\d+)\}\}", name)
        if not secure and m:  # simulated template evaluation, arithmetic only
            return {"message": f"Hello {int(m[1]) * int(m[2])}"}
        return {"message": "Hello " + html.escape(name)}

    @app.get("/tools/ping")
    def ping(host: str = Query(...)):
        if secure:
            if not re.fullmatch(r"[A-Za-z0-9.-]{1,80}", host):
                raise HTTPException(422, "invalid host")
        elif re.search(r"[;|&]", host):  # simulated shell metacharacter handling; nothing is executed
            return {"output": "uid=1000(synthetic-sim) gid=1000(synthetic-sim)"}
        return {"output": f"simulated ping to {host}"}

    @app.get("/redirect")
    def redirect(next: str = Query(...)):
        if secure and (not next.startswith("/") or next.startswith("//")):
            raise HTTPException(400, "relative paths only")
        return RedirectResponse(next, status_code=302)

    @app.get("/export")
    def export(filename: str = Query(...)):
        if secure and re.search(r"[\r\n]", filename):
            raise HTTPException(400, "invalid filename")
        return Response("synthetic,export", headers={"X-Export-Name": filename})

    @app.get("/preview")
    def preview(url: str = Query(...)):
        if secure:
            if not url.startswith("https://partner-cdn.example.test/"):
                raise HTTPException(400, "url not allowed")
            return {"content": "simulated partner content"}
        return {"content": MOCK_INTERNAL.get(url, "simulated fetch")}  # mock only, no network

    @app.post("/documents/upload")
    def upload(body: UploadIn, creds=Depends(bearer)):
        auth(creds)
        if secure:
            ok = body.filename.lower().endswith((".pdf", ".png", ".jpg")) and body.content_type in ("application/pdf", "image/png", "image/jpeg") and body.size <= 1_000_000
            if not ok:
                raise HTTPException(415, "file type or size not allowed")
        return {"stored": body.filename}

    from fastapi.responses import HTMLResponse
    PAGES = {"": ("Home", ["/ui/login", "/ui/bookings", "/ui/refund", "/ui/agency"]), "login": ("Login", ["/ui/"]),
             "bookings": ("Bookings", ["/ui/", "/ui/refund"]), "refund": ("Refunds", ["/ui/bookings"]), "agency": ("Agency users", ["/ui/"])}

    @app.get("/ui/{page:path}", include_in_schema=False)
    def ui(page: str):
        title, links = PAGES.get(page.strip("/"), ("Not found", []))
        a = "".join(f'<a href="{h}">{h}</a> ' for h in links)
        return HTMLResponse(f'<html><body><h1>{title} (SYNTHETIC)</h1>{a}<script src="/static/app.js"></script></body></html>')

    @app.get("/static/app.js", include_in_schema=False)
    def appjs():
        js = """const api = {
  search: "/flights/search?origin=DEL&dest=BOM", booking: id => fetch("/bookings/" + id), refund: "/bookings/BK-1001/refund",
  coupon: "/coupons/apply", debug: "/api/internal/debug/config", login: "/auth/login" };"""
        return Response(js, media_type="application/javascript")

    if version >= 2:
        @app.post("/bookings/{booking_id}/modify")
        def modify(booking_id: str, body: dict = Body(...), creds=Depends(bearer)):
            u, b = auth(creds), get(booking_id)
            if secure:
                if not own(u, b):
                    raise HTTPException(404, "booking not found")
                if set(body) - {"seat", "passenger"}:
                    raise HTTPException(422, "unexpected fields")
            body.pop("id", None)
            b.update(body)
            return view(b)

        @app.get("/agency/reports/summary")
        def summary(creds=Depends(bearer)):
            u = auth(creds)
            mine = [b for b in bookings.values() if own(u, b)]
            return {"bookings": len(mine), "agency": u["agency"]}

    return app
