"""Load the canonical role definitions from agents/*.md.

This is the single source of truth shared with Cursor and Claude Code. Pure standard
library so it can be imported without CrewAI installed (used by `--plan`).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENTS_DIR = REPO_ROOT / "agents"
BLACKBOARD_TEMPLATES = REPO_ROOT / "workflow" / "blackboard"


@dataclass
class Role:
    name: str
    profile: str
    goal: str
    description: str
    backstory: str
    model: str = "inherit"
    track: str = ""
    order: int = 99
    reads: List[str] = field(default_factory=list)
    writes: List[str] = field(default_factory=list)
    handoff_to: List[str] = field(default_factory=list)

    @property
    def artifact(self) -> str:
        """Primary blackboard file this role writes."""
        return self.writes[0] if self.writes else "{}.md".format(self.name)


def _split_frontmatter(text: str) -> Tuple[Dict[str, object], str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text
    fm_lines: List[str] = []
    i = 1
    while i < len(lines) and lines[i].strip() != "---":
        fm_lines.append(lines[i])
        i += 1
    body = "\n".join(lines[i + 1:]).lstrip("\n")
    meta: Dict[str, object] = {}
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


def _as_int(v: object, default: int = 99) -> int:
    try:
        return int(str(v))
    except (TypeError, ValueError):
        return default


def load_roles(agents_dir: Path = AGENTS_DIR) -> List[Role]:
    """Parse every agents/*.md into a Role, sorted by their `order` field."""
    roles: List[Role] = []
    for path in sorted(agents_dir.glob("*.md")):
        meta, body = _split_frontmatter(path.read_text(encoding="utf-8"))

        def _list(key: str) -> List[str]:
            v = meta.get(key, [])
            return v if isinstance(v, list) else [v] if v else []

        roles.append(
            Role(
                name=str(meta.get("name") or path.stem),
                profile=str(meta.get("profile") or meta.get("name") or path.stem),
                goal=str(meta.get("goal") or ""),
                description=str(meta.get("description") or ""),
                backstory=body.strip(),
                model=str(meta.get("model") or "inherit"),
                track=str(meta.get("track") or ""),
                order=_as_int(meta.get("order")),
                reads=_list("reads"),
                writes=_list("writes"),
                handoff_to=_list("handoff_to"),
            )
        )
    roles.sort(key=lambda r: r.order)
    return roles


# Who feeds whom — used to wire CrewAI task context (the handoff graph).
DEPENDENCIES: Dict[str, List[str]] = {
    "orchestrator-pm": [],
    "architect": ["orchestrator-pm"],
    "designer": ["orchestrator-pm"],
    "developer": ["orchestrator-pm", "architect", "designer"],
    "reviewer": ["developer"],
    "qa": ["orchestrator-pm", "developer", "reviewer"],
    "integrator": ["developer", "qa"],
}
