"""CLI entry point for the autonomous AI dev team engine.

Examples:
    devteam --plan                      # show the pipeline, no LLM calls
    devteam "Build a URL shortener"     # run the full crew
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import shutil
import sys
from pathlib import Path

from .roles import BLACKBOARD_TEMPLATES, load_roles


def seed_blackboard(blackboard: Path) -> None:
    """Copy the blackboard templates into the run directory if not already present."""
    blackboard.mkdir(parents=True, exist_ok=True)
    if BLACKBOARD_TEMPLATES.is_dir():
        for tpl in sorted(BLACKBOARD_TEMPLATES.glob("*")):
            dest = blackboard / tpl.name
            if not dest.exists():
                shutil.copy(tpl, dest)


def print_plan(roles, requirement) -> None:
    print("AI dev team pipeline ({} roles)".format(len(roles)))
    print("=" * 48)
    if requirement:
        print("Requirement: {}\n".format(requirement))
    for r in roles:
        print("{}. {:<22} -> writes {}".format(r.order, r.profile, r.artifact))
        if r.goal:
            print("     goal: {}".format(r.goal))
    print("\nCoordination: shared .devteam/ blackboard, sequential handoffs (see workflow/SOP.md)")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="devteam", description="Run the AI dev team (CrewAI engine)."
    )
    parser.add_argument("requirement", nargs="?", help="What to build.")
    parser.add_argument(
        "--blackboard", default=".devteam", help="Shared coordination dir (default: .devteam)."
    )
    parser.add_argument("--model", default=None, help="LLM model (default: $DEVTEAM_MODEL or gpt-4o-mini).")
    parser.add_argument("--plan", action="store_true", help="Print the pipeline and exit (no LLM calls).")
    args = parser.parse_args(argv)

    roles = load_roles()
    if not roles:
        print("No roles found in agents/. Is the repo intact?", file=sys.stderr)
        return 1

    if args.plan or not args.requirement:
        print_plan(roles, args.requirement)
        if not args.requirement:
            print('\nProvide a requirement to run, e.g.: devteam "Build a URL shortener"')
        return 0

    blackboard = Path(args.blackboard).resolve()
    seed_blackboard(blackboard)
    print("Blackboard: {}".format(blackboard))

    try:
        from .crew import build_crew
    except ImportError as exc:  # pragma: no cover
        print(
            "CrewAI is not installed. Install it with:\n"
            "  cd crew && ./.venv/bin/python -m pip install -e .\n"
            "Original error: {}".format(exc),
            file=sys.stderr,
        )
        return 2

    crew = build_crew(args.requirement, roles, blackboard, model=args.model)
    result = crew.kickoff(inputs={"requirement": args.requirement})

    # Record completion in the shared state file.
    state_path = blackboard / "state.json"
    try:
        state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    except json.JSONDecodeError:
        state = {}
    state.update(
        {
            "project": args.requirement,
            "phase": "merge",
            "current_owner": "orchestrator-pm",
            "updated_at": _dt.datetime.now().isoformat(timespec="seconds"),
        }
    )
    state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")

    print("\n=== Run complete. Artifacts in {} ===".format(blackboard))
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
