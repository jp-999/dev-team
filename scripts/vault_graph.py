#!/usr/bin/env python3
"""Build an Obsidian-style backlinks index + graph.json from the vault's [[wikilinks]] and #tags.

Stdlib only — lets the team's knowledge graph work even without Obsidian installed. Obsidian
renders the same links/tags natively; this just makes them queryable from scripts/agents too.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VAULT = ROOT / "vault"
WIKI = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]")
TAG = re.compile(r"(?<![\w/])#([a-zA-Z][\w/-]+)")


def main():
    if not VAULT.is_dir():
        print("no vault/ found")
        return
    notes = {}
    for p in sorted(VAULT.rglob("*.md")):
        if p.name in ("Backlinks.md",):
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        notes[p.stem] = {
            "path": str(p.relative_to(ROOT)),
            "links": [l.strip() for l in WIKI.findall(text)],
            "tags": sorted(set(TAG.findall(text))),
        }

    nodes, edges, backlinks = set(notes.keys()), [], {}
    for name, n in notes.items():
        for link in n["links"]:
            nodes.add(link)
            edges.append({"from": name, "to": link})
            backlinks.setdefault(link, []).append(name)

    graph = {
        "nodes": sorted(nodes),
        "edges": edges,
        "tags": sorted({t for n in notes.values() for t in n["tags"]}),
    }
    (VAULT / "graph.json").write_text(json.dumps(graph, indent=2) + "\n", encoding="utf-8")

    lines = ["---", "tags: [generated]", "---", "# Backlinks (generated)", ""]
    for target in sorted(backlinks):
        srcs = ", ".join("[[%s]]" % s for s in sorted(set(backlinks[target])))
        lines.append("- [[%s]] ← %s" % (target, srcs))
    (VAULT / "Backlinks.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("vault_graph: %d notes, %d nodes, %d links, %d tags" % (
        len(notes), len(nodes), len(edges), len(graph["tags"])))


if __name__ == "__main__":
    main()
