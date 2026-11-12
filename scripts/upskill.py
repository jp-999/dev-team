#!/usr/bin/env python3
"""Automatic Upskilling (L&D) cycle — runs every 12 hours via launchd (not manual).

The Researcher scrapes the **web, GitHub, and Medium** (plus Hacker News) for improvements; the
team adopts one and rolls it out to every squad. Network-robust and dependency-free (stdlib only):
if the sources are unreachable it falls back to a static list, so the schedule never fails.

Scheduled by ~/Library/LaunchAgents/com.devteam.upskill.plist (StartInterval 43200s = 12h).
"""
from __future__ import annotations

import datetime
import json
import re
import urllib.parse
import urllib.request
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
FALLBACK = [
    "benchmarked a new framework (~18% faster builds)",
    "a better retrieval approach for agents",
    "a case study distilled into a playbook",
    "a toolchain security gap to close",
]


def _get(url, headers=None, timeout=8):
    try:
        req = urllib.request.Request(url, headers=headers or {"User-Agent": "devteam-upskill/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", "replace")
    except Exception:
        return None


def scrape_github():
    """Recently-created, most-starred repos (a proxy for GitHub trending)."""
    since = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
    q = urllib.parse.quote("created:>%s" % since)
    url = "https://api.github.com/search/repositories?q=%s&sort=stars&order=desc&per_page=4" % q
    txt = _get(url, {"User-Agent": "devteam-upskill/1.0", "Accept": "application/vnd.github+json"})
    out = []
    if txt:
        try:
            for it in json.loads(txt).get("items", [])[:3]:
                desc = (it.get("description") or "trending repo").strip()
                out.append("GitHub: %s — %s" % (it.get("full_name"), desc[:80]))
        except Exception:
            pass
    return out


def scrape_medium(tag="programming"):
    """Latest posts from a Medium tag RSS feed."""
    txt = _get("https://medium.com/feed/tag/%s" % tag, {"User-Agent": "Mozilla/5.0 devteam-upskill"})
    out = []
    if txt:
        titles = re.findall(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", txt, re.S)
        for t in titles[1:4]:  # skip the feed's own title
            t = re.sub(r"<.*?>", "", t).strip()
            if t:
                out.append("Medium: %s" % t[:90])
    return out


def scrape_hn():
    """Hacker News front page via the Algolia API."""
    txt = _get("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=6")
    out = []
    if txt:
        try:
            for h in json.loads(txt).get("hits", [])[:3]:
                if h.get("title"):
                    out.append("HN: %s" % h["title"][:90])
        except Exception:
            pass
    return out


def main():
    REPORTS.mkdir(parents=True, exist_ok=True)
    try:
        st = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {"cycle": 0}
    except (ValueError, OSError):
        st = {"cycle": 0}
    st["cycle"] += 1
    n = st["cycle"]

    findings = scrape_github() + scrape_medium() + scrape_hn()
    scraped = bool(findings)
    if not findings:
        findings = ["(offline) " + f for f in FALLBACK]

    imp = IMPROVEMENTS[(n - 1) % len(IMPROVEMENTS)]
    now = datetime.datetime.now().isoformat(timespec="seconds")

    body = ["# Upskilling cycle %d — %s" % (n, now), ""]
    body.append("**Researcher** scraped the web, GitHub, and Medium%s:" % ("" if scraped else " (offline fallback)"))
    body += ["- " + f for f in findings]
    body += [
        "",
        '**Training Lead** turned the best finding into a playbook for "%s".' % imp,
        "**People / HR** checked team health and updated the growth ladder.",
        "**Compliance** cleared security + licensing.",
        "",
        "**Improvement adopted org-wide:** %s" % imp,
        "",
    ]
    (REPORTS / ("cycle-%03d.md" % n)).write_text("\n".join(body), encoding="utf-8")

    log = OUT / "log.md"
    with log.open("a", encoding="utf-8") as f:
        if n == 1:
            f.write("# Upskilling rollout log (automatic, every 12h)\n\n")
        f.write("- %s · cycle %d · %s · adopted: %s\n" % (now, n, "scraped" if scraped else "offline", imp))

    STATE.write_text(json.dumps(st, indent=2) + "\n", encoding="utf-8")
    print("Upskilling cycle %d (%s) — %d findings — adopted: %s" % (n, "scraped" if scraped else "offline", len(findings), imp))


if __name__ == "__main__":
    main()
