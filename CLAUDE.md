# CLAUDE.md

This project is an AI development team. The full operating manual is in `AGENTS.md`:

@AGENTS.md

## Claude Code specifics
- The role agents are installed as **subagents** in `.claude/agents/` — invoke them with the
  `Task` tool. They are generated from `agents/`; edit the canonical files there and run
  `python3 scripts/sync_harnesses.py` to regenerate.
- Use the **`/devteam`** slash command to start a run, or just describe what you want and act
  as `orchestrator-pm` per `AGENTS.md`.
- Coordinate only through the `.devteam/` blackboard described in `workflow/SOP.md`.
