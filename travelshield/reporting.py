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


def _fallback_pdf(title, items, path):
    text_lines = [
        title,
        "Synthetic demonstration environment. TravelShield AI Executive Security Report.",
        f"Generated: {now()}",
        "",
        f"{'ID':<10} {'PRI':<6} {'SCORE':<7} {'STATUS':<10} {'TITLE'}",
        "-" * 72
    ]
    for x in items:
        text_lines.append(f"{x['id']:<10} {x['priority']:<6} {x['risk_score']:<7} {x['status']:<10} {x['title'][:36]}")
    text_lines += ["", "KEY FINDINGS & REMEDIATION:"]
    for x in items[:10]:
        text_lines.append(f"[{x['id']}] {x['title']}")
        text_lines.append(f"  Endpoint: {x['endpoint']} | Severity: {x['severity']}")
        text_lines.append(f"  Remediation: {x['remediation'][:75]}")
        text_lines.append("")

    stream_content = "BT\n/F1 10 Tf\n40 780 Td\n13 TL\n"
    for line in text_lines[:54]:
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream_content += f"({escaped}) '\n"
    stream_content += "ET\n"
    stream_bytes = stream_content.encode("latin-1", "replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(stream_bytes)} >>\nstream\n".encode("ascii") + stream_bytes + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"
    ]

    pdf_bytes = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(pdf_bytes))
        pdf_bytes.extend(f"{i} 0 obj\n".encode("ascii"))
        pdf_bytes.extend(obj)
        pdf_bytes.extend(b"\nendobj\n")

    xref_offset = len(pdf_bytes)
    pdf_bytes.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii"))
    for off in offsets:
        pdf_bytes.extend(f"{off:010d} 00000 n \n".encode("ascii"))
    pdf_bytes.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("ascii"))

    pathlib.Path(path).write_bytes(pdf_bytes)
    return path


def pdf(db, path):
    f = rows(db, "SELECT * FROM findings ORDER BY risk_score DESC")
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
        st = getSampleStyleSheet()
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
    except Exception:
        return _fallback_pdf("TravelShield AI - Executive Security Report", f, path)
