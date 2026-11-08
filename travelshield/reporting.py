import csv, json, pathlib
from .db import rows, now


def export(db, out):
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    f = rows(db, "SELECT * FROM findings ORDER BY risk_score DESC")
    (out / "findings.json").write_text(json.dumps(f, indent=2))
    with open(out / "findings.csv", "w", newline="") as fh:
        cols = ["id", "title", "category", "severity", "priority", "risk_score", "status", "endpoint", "workflow", "confidence"]
        w = csv.DictWriter(fh, cols, extrasaction="ignore"); w.writeheader(); w.writerows(f)
    for x in f:
        ev = rows(db, "SELECT kind,payload,ts FROM evidence WHERE finding_id=? ORDER BY id", x["id"])
        lines = [f"# {x['id']}: {x['title']}", "",
                 "*Synthetic demonstration environment. Not a finding in any real TBO system.*", "",
                 f"- Severity: {x['severity']}  |  Business priority: {x['priority']} (score {x['risk_score']})",
                 f"- Status: {x['status']}  |  Confidence: {x['confidence']}",
                 f"- Endpoint: `{x['endpoint']}`  |  Workflow: {x['workflow']}",
                 f"- First detected: {x['first_detected']}  |  Last detected: {x['last_detected']}", "",
                 "## Risk scoring", *[f"- {w}" for w in json.loads(x["risk_json"])], "",
                 "## Remediation", x["remediation"], "", "## Evidence timeline"]
        for e in ev:
            p = json.loads(e["payload"])
            lines += [f"### {e['kind']} @ {e['ts']}", f"Expected: {p.get('expected', '-')}", f"Actual: {p.get('actual', p)}"]
            for key in ("attack", "confirmation"):
                for t in p.get(key, []):
                    lines.append(f"- {t['actor']} `{t['method']} {t['path']}` -> {t['status']}")
        (out / f"{x['id']}.md").write_text("\n".join(lines))
    sev = {}
    for x in f: sev[x["severity"]] = sev.get(x["severity"], 0) + 1
    (out / "executive_summary.json").write_text(json.dumps(dict(
        generated=now(), total=len(f), by_severity=sev,
        verified=sum(x["status"] == "Verified" for x in f), resolved=sum(x["status"] == "Resolved" for x in f)), indent=2))
    return out


def pdf(db, path):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
    st, f = getSampleStyleSheet(), rows(db, "SELECT * FROM findings ORDER BY risk_score DESC")
    els = [Paragraph("TravelShield AI - Executive Security Report", st["Title"]),
           Paragraph("Synthetic demonstration environment. Findings do not describe any real TBO system.", st["Italic"]),
           Spacer(1, 12), Paragraph(f"Generated {now()}. {len(f)} findings, "
           f"{sum(x['status'] == 'Verified' for x in f)} verified, {sum(x['status'] == 'Resolved' for x in f)} resolved.", st["Normal"]),
           Spacer(1, 12)]
    t = Table([["ID", "Pri", "Score", "Status", "Title"]] + [[x["id"], x["priority"], x["risk_score"], x["status"], x["title"][:55]] for x in f])
    els += [t, Spacer(1, 12)]
    for x in f:
        els += [Paragraph(f"{x['id']}: {x['title']}", st["Heading3"]),
                Paragraph(f"Endpoint {x['endpoint']} | workflow {x['workflow']} | severity {x['severity']}", st["Normal"]),
                Paragraph("Remediation: " + x["remediation"], st["Normal"]), Spacer(1, 6)]
    SimpleDocTemplate(str(path), pagesize=A4).build(els)
    return path
