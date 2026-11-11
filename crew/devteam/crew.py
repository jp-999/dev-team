"""Build a CrewAI crew from the canonical roles.

The role markdown bodies become CrewAI agent backstories; the handoff graph in
`roles.DEPENDENCIES` becomes CrewAI task context; each role's primary blackboard file
becomes that task's `output_file`. CrewAI is imported lazily so `--plan` works without it.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List

from .roles import DEPENDENCIES, REPO_ROOT, Role

# Keep CrewAI's storage (memory, embeddings cache) inside the repo instead of the
# user's home dir, so runs are self-contained and reproducible.
os.environ.setdefault("CREWAI_STORAGE_DIR", str(REPO_ROOT / "crew" / ".crewai_storage"))


def _task_description(role: Role, requirement: str, blackboard: Path) -> str:
    inputs = ", ".join(role.reads) or "the requirement"
    return (
        "Requirement from the human:\n"
        "\"\"\"\n{requirement}\n\"\"\"\n\n"
        "You are the {profile}. {goal}\n\n"
        "Authoritative inputs: {inputs} (the relevant ones are provided to you as context "
        "from the previous roles). Follow your role instructions exactly and stay within the "
        "spec's scope. Produce ONLY your deliverable's content (no preamble); it will be saved "
        "to {blackboard}/{artifact}."
    ).format(
        requirement=requirement,
        profile=role.profile,
        goal=role.goal,
        inputs=inputs,
        blackboard=blackboard.name,
        artifact=role.artifact,
    )


def _expected_output(role: Role) -> str:
    return (
        "A complete, well-structured `{}` that fulfills the "
        "responsibilities and 'Outputs' section of the {} role.".format(role.artifact, role.profile)
    )


def build_crew(requirement: str, roles: List[Role], blackboard: Path, model: str = None):
    """Return a configured CrewAI Crew. Requires crewai to be installed."""
    from crewai import Agent, Crew, Process, Task  # lazy import

    model_name = model or os.getenv("DEVTEAM_MODEL", "gpt-4o-mini")

    # LLM: CrewAI routes through LiteLLM, so `model` accepts OpenAI, Anthropic, etc.
    try:
        from crewai import LLM

        llm = LLM(model=model_name)
    except Exception:  # pragma: no cover - older crewai
        llm = model_name

    agents: Dict[str, "Agent"] = {}
    for r in roles:
        agents[r.name] = Agent(
            role=r.profile,
            goal=r.goal or "Fulfill the {} responsibilities.".format(r.profile),
            backstory=r.backstory,
            llm=llm,
            allow_delegation=False,
            verbose=True,
        )

    blackboard.mkdir(parents=True, exist_ok=True)
    tasks: Dict[str, "Task"] = {}
    for r in roles:
        context = [tasks[d] for d in DEPENDENCIES.get(r.name, []) if d in tasks]
        tasks[r.name] = Task(
            description=_task_description(r, requirement, blackboard),
            expected_output=_expected_output(r),
            agent=agents[r.name],
            context=context,
            output_file=str(blackboard / r.artifact),
        )

    ordered = [r.name for r in roles]
    return Crew(
        agents=[agents[n] for n in ordered],
        tasks=[tasks[n] for n in ordered],
        process=Process.sequential,
        verbose=True,
    )
