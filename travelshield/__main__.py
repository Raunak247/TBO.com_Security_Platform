import asyncio, sys
from .db import connect, rows
from . import pipeline


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "demo"
    if cmd == "serve":
        import uvicorn; uvicorn.run("travelshield.api:app", port=8000); return
    db = connect("travelshield.db")
    r = asyncio.run(pipeline.run_cycle(db))
    print(f"changes: +{len(r['changes']['added'])} ~{len(r['changes']['modified'])} | zombie {len(r['zombies'])} | shadow {len(r['shadows'])} | plan {len(r['plan'])} | requests {r['requests']}")
    for f in rows(db, "SELECT * FROM findings ORDER BY risk_score DESC"):
        print(f"{f['id']} {f['priority']} {f['risk_score']:>4} {f['status']:<9} {f['endpoint']:<38} {f['title']}")
    print("retest on fixed target:", asyncio.run(pipeline.retest_all(db)))


main()
