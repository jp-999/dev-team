# devteam — autonomous CrewAI engine

Runs the shared `agents/` roles as an autonomous [CrewAI](https://github.com/crewAIInc/crewAI)
crew. The role markdown becomes agent backstories; the handoff graph becomes task context;
each role writes its artifact into the `.devteam/` blackboard.

## Setup (Python 3.13 — CrewAI does not support 3.14/3.15 yet)

```bash
cd crew
# .venv was created on Python 3.13 during setup. If you need to recreate it:
#   /opt/homebrew/bin/python3.13 -m venv .venv
./.venv/bin/python -m pip install -e .
cp .env.example .env   # then add your API key
```

## Use

```bash
./.venv/bin/python -m devteam.main --plan                  # show the pipeline, no LLM calls
./.venv/bin/python -m devteam.main "Build a URL shortener" # run the full team
```

Artifacts land in `./.devteam/` (`spec.md`, `architecture.md`, `design.md`,
`implementation.md`, `review.md`, `qa-report.md`, `delivery.md`, `state.json`).

Edit roles in the repo's top-level `agents/` directory — this engine reads them directly.
