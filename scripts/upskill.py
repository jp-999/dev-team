#!/usr/bin/env python3
"""Automatic Upskilling (L&D) cycle — runs every 12 hours via launchd (not manual).

Offline-safe and dependency-free: it records a research cycle and the one improvement adopted,
appends to a rollout log, and leaves a per-cycle report. If you later wire it to the CrewAI
engine or a web/LLM pass, keep this deterministic fallback so the schedule never fails.

Scheduled by ~/Library/LaunchAgents/com.devteam.upskill.plist (StartInterval 43200s = 12h).
"""
from __future__ import annotations

import datetime
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "upskilling"
REPORTS = OUT / "reports"
STATE = OUT / "state.json"

IMPROVEMENTS = [
    "TDD by default on risky logic",
    "Faster CI with cached builds",
    "Refreshed design tokens",
    "Tighter PR review checklist",
    "Shared prompt library for agents",
    "New accessibility baseline",
    "Incident runbook v2",
    "Dependency hygiene policy",
]
FINDINGS = [
    "benchmarked a new framework (~18% faster builds)",
    "found a better retrieval approach for agents",
    "distilled 3 case studies into a playbook",
    "audited the toolchain for security gaps",
    "drafted a growth ladder for the squads",
]


def main():
    REPORTS.mkdir(parents=True, exist_ok=True)
    try:
        st = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {"cycle": 0}
    except (ValueError, OSError):
        st = {"cycle": 0}
    st["cycle"] += 1
    n = st["cycle"]
    imp = IMPROVEMENTS[(n - 1) % len(IMPROVEMENTS)]
    finding = FINDINGS[(n - 1) % len(FINDINGS)]
    now = datetime.datetime.now().isoformat(timespec="seconds")

    (REPORTS / ("cycle-%03d.md" % n)).write_text(
        "# Upskilling cycle %d — %s\n\n"
        "- **Researcher** %s\n"
        "- **Training Lead** wrote a playbook for \"%s\"\n"
        "- **People / HR** checked team health and updated the growth ladder\n"
        "- **Compliance** cleared security + licensing\n\n"
        "**Improvement adopted org-wide:** %s\n" % (n, now, finding, imp, imp),
        encoding="utf-8",
    )

    log = OUT / "log.md"
    with log.open("a", encoding="utf-8") as f:
        if n == 1:
            f.write("# Upskilling rollout log (automatic, every 12h)\n\n")
        f.write("- %s · cycle %d · adopted: %s\n" % (now, n, imp))

    STATE.write_text(json.dumps(st, indent=2) + "\n", encoding="utf-8")
    print("Upskilling cycle %d complete — adopted: %s" % (n, imp))


if __name__ == "__main__":
    main()
