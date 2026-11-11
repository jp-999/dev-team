#!/usr/bin/env python3
"""Regenerate harness-specific agent files from the canonical definitions in agents/.

Single source of truth: agents/*.md (Claude Code subagent format + extra metadata).
This script generates:
  - .claude/agents/<name>.md   (Claude Code subagents)
  - .cursor/rules/<nn>-<name>.mdc  (Cursor rules, one per role)
  - .cursor/rules/00-devteam-orchestrator.mdc  (how Cursor should run the team)

Pure standard library; runs on Python 3.9+.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = ROOT / "agents"
CLAUDE_DIR = ROOT / ".claude" / "agents"
CURSOR_DIR = ROOT / ".cursor" / "rules"
SKILLS_DIR = ROOT / "skills"
CLAUDE_SKILLS_DIR = ROOT / ".claude" / "skills"

CLAUDE_KEYS = ["name", "description", "tools", "model"]


def split_frontmatter(text):
    """Return (meta_dict, body) from a markdown file with YAML-ish frontmatter."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text
    fm_lines = []
    i = 1
    while i < len(lines) and lines[i].strip() != "---":
        fm_lines.append(lines[i])
        i += 1
    body = "\n".join(lines[i + 1:]).lstrip("\n")
    meta = {}
    for ln in fm_lines:
        s = ln.strip()
        if not s or s.startswith("#") or ":" not in ln:
            continue
        key, _, val = ln.partition(":")
        key, val = key.strip(), val.strip()
        if val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            items = [x.strip().strip("\"'") for x in inner.split(",")] if inner else []
            meta[key] = [x for x in items if x]
        else:
            meta[key] = val.strip("\"'")
    return meta, body


def _as_str(v):
    return ", ".join(v) if isinstance(v, list) else v


def to_claude(meta, body):
    out = ["---"]
    for k in CLAUDE_KEYS:
        v = meta.get(k)
        if not v:
            continue
        if k in ("description",):
            out.append('{}: "{}"'.format(k, _as_str(v).replace('"', "'")))
        else:
            out.append("{}: {}".format(k, _as_str(v)))
    out.append("---")
    return "\n".join(out) + "\n\n" + body.rstrip() + "\n"


def to_cursor(meta, body):
    desc = _as_str(meta.get("description", "")).replace('"', "'")
    profile = _as_str(meta.get("profile", meta.get("name", "")))
    name = _as_str(meta.get("name", ""))
    head = [
        "---",
        'description: "{}"'.format(desc),
        "globs: ",
        "alwaysApply: false",
        "---",
        "",
        "# Role: {} (`{}`)".format(profile, name),
        "",
        "> Generated from `agents/{}.md`. Do not edit here — edit the canonical file.".format(name),
        "",
    ]
    return "\n".join(head) + body.rstrip() + "\n"


ORCHESTRATOR_RULE = """---
description: "AI dev team orchestration. Use whenever asked to build, implement, design, or fix a feature in this project."
globs: 
alwaysApply: false
---

# AI Dev Team — Orchestrator

When asked to build/implement/design/fix something here, act as **orchestrator-pm**
(`agents/orchestrator-pm.md`) and follow `workflow/SOP.md`:

1. Seed a `.devteam/` blackboard from `workflow/blackboard/` if absent.
2. Write `spec.md` + `tasks.yaml`, then advance phase by phase:
   architect -> designer -> developer -> reviewer -> qa -> integrator -> merge.
3. For each phase, adopt the matching role in `.cursor/rules/` (or `agents/`),
   passing only the blackboard files as context.
4. Enforce the gates; loop review/QA failures back to the developer (max 3 rounds).
5. Keep `.devteam/state.json` and `.devteam/log.md` current on every handoff.
6. Stop at the merge gate and report.
"""


def install_user():
    """Install the generated agents, skills, and a /devteam command into ~/.claude (user scope),
    so Claude Code can use the whole team from any project. Run after the project sync."""
    home = Path.home() / ".claude"
    agents_d, skills_d, cmds_d = home / "agents", home / "skills", home / "commands"
    for d in (agents_d, skills_d, cmds_d):
        d.mkdir(parents=True, exist_ok=True)
    out = []
    for f in sorted(CLAUDE_DIR.glob("*.md")):
        dest = agents_d / f.name
        dest.write_text(f.read_text(encoding="utf-8"), encoding="utf-8")
        out.append(dest)
    if SKILLS_DIR.is_dir():
        for skill in sorted(SKILLS_DIR.glob("*/SKILL.md")):
            d = skills_d / skill.parent.name
            if d.exists():
                continue  # preserve an already-installed skill (e.g. the graphify engine's)
            d.mkdir(parents=True, exist_ok=True)
            (d / "SKILL.md").write_text(skill.read_text(encoding="utf-8"), encoding="utf-8")
            out.append(d / "SKILL.md")
    cmd = (
        "---\n"
        "description: Run the AI dev team pipeline on a request\n"
        "argument-hint: [what to build]\n"
        "---\n"
        "Act as the **orchestrator-pm** of the AI dev team.\n\n"
        "Read the operating manual and pipeline first (absolute paths):\n"
        "- {root}/AGENTS.md\n"
        "- {root}/workflow/SOP.md\n"
        "- {root}/workflow/blackboard/chapters.md  (squads x chapters matrix)\n\n"
        "The roles are installed as subagents (orchestrator-pm, architect, designer, developer, "
        "reviewer, qa, integrator) — dispatch each phase to the matching one with the Task tool. "
        "Seed a `.devteam/` blackboard from {root}/workflow/blackboard/ if absent, drive the "
        "pipeline, enforce the gates, and keep state.json + log.md current.\n\n"
        "Requirement:\n$ARGUMENTS\n"
    ).format(root=str(ROOT))
    (cmds_d / "devteam.md").write_text(cmd, encoding="utf-8")
    out.append(cmds_d / "devteam.md")
    print("Installed to {} (user scope):".format(home))
    for p in out:
        print("  {}".format(p))


def main():
    if not AGENTS_DIR.is_dir():
        print("No agents/ directory found at {}".format(AGENTS_DIR), file=sys.stderr)
        return 1
    CLAUDE_DIR.mkdir(parents=True, exist_ok=True)
    CURSOR_DIR.mkdir(parents=True, exist_ok=True)

    written = []
    role_files = sorted(AGENTS_DIR.glob("*.md"))
    if not role_files:
        print("No role files in agents/", file=sys.stderr)
        return 1

    for path in role_files:
        meta, body = split_frontmatter(path.read_text(encoding="utf-8"))
        name = _as_str(meta.get("name") or path.stem)
        try:
            order = int(_as_str(meta.get("order", "99")))
        except (TypeError, ValueError):
            order = 99

        claude_path = CLAUDE_DIR / "{}.md".format(name)
        claude_path.write_text(to_claude(meta, body), encoding="utf-8")
        written.append(claude_path)

        cursor_path = CURSOR_DIR / "{:02d}-{}.mdc".format(order, name)
        cursor_path.write_text(to_cursor(meta, body), encoding="utf-8")
        written.append(cursor_path)

    orch_path = CURSOR_DIR / "00-devteam-orchestrator.mdc"
    orch_path.write_text(ORCHESTRATOR_RULE, encoding="utf-8")
    written.append(orch_path)

    # Skills: install canonical skills/<name>/SKILL.md into Claude Code's skills dir.
    skill_count = 0
    if SKILLS_DIR.is_dir():
        for skill in sorted(SKILLS_DIR.glob("*/SKILL.md")):
            dest_dir = CLAUDE_SKILLS_DIR / skill.parent.name
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / "SKILL.md"
            dest.write_text(skill.read_text(encoding="utf-8"), encoding="utf-8")
            written.append(dest)
            skill_count += 1

    print("Synced {} role(s) + {} skill(s) -> {} files".format(len(role_files), skill_count, len(written)))
    for p in written:
        print("  {}".format(p.relative_to(ROOT)))

    if "--user" in sys.argv:
        install_user()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
