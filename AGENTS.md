# AI Development Team

A cross-harness team of role agents — **PM/Orchestrator, Architect, Designer, Developer,
Reviewer, QA, Integrator** — that coordinate through shared files to take a request from
idea to shippable change. The same role definitions run in **Cursor**, **Claude Code**, and
an autonomous **CrewAI** engine.

> This file is the operating manual. Cursor and Claude Code both read it automatically.

## How to run it

- **Cursor** — ask the agent to build something; it follows this manual as the
  orchestrator and pulls in the per-role rules from `.cursor/rules/`.
- **Claude Code** — run `/devteam <what to build>`, or just ask; the orchestrator delegates
  to the subagents in `.claude/agents/` via the Task tool. To use the team from **any** project,
  install it user-wide: `python3 scripts/sync_harnesses.py --user` (copies the roles, skills, and
  `/devteam` command into `~/.claude/`).
- **CrewAI (autonomous)** — `cd crew && ./.venv/bin/python -m devteam.main "<what to build>"`.

All three read the **same** role definitions in [`agents/`](agents/) and follow the **same**
pipeline in [`workflow/SOP.md`](workflow/SOP.md).

## The team

| Order | Role | File | Owns |
|------:|------|------|------|
| 1 | PM / Orchestrator | `agents/orchestrator-pm.md` | Spec, plan, coordination, merge gate |
| 2 | Architect | `agents/architect.md` | Interfaces, data model, tech decisions |
| 3 | Designer (UX) | `agents/designer.md` | Flows, screens, components, tokens |
| 4 | Developer | `agents/developer.md` | Implementation |
| 5 | Code Reviewer | `agents/reviewer.md` | Correctness, security, quality |
| 6 | QA / Tester | `agents/qa.md` | Tests + acceptance verification |
| 7 | DevOps / Integrator | `agents/integrator.md` | Build, integrate, release readiness |

Plus an **Upskilling (L&D)** team — Researcher, Training Lead, People/HR, Compliance
(`agents/researcher.md`, `trainer.md`, `hr.md`, `compliance.md`) — that runs **automatically every
12 hours**, finds improvements, and rolls them out to every squad. See
[`workflow/upskilling.md`](workflow/upskilling.md).

## Org model: squads × chapters

The team is a **matrix**: **squads** (Atlas / Nova / Orion / Platform / Leadership) own delivery
end-to-end, and **chapters** (Product, Design, Architecture, Engineering, Quality, Platform) group
each craft across squads to set standards and make discipline-wide decisions. Every role has a
`chapter:` in its frontmatter; the full roster, leads, and decision flow are in
[`workflow/blackboard/chapters.md`](workflow/blackboard/chapters.md).

## How they coordinate

No agent calls another directly. They read and write a shared **blackboard** in a `.devteam/`
directory at the root of the project being built (templates in `workflow/blackboard/`):
`spec.md`, `tasks.yaml`, `architecture.md`, `design.md`, `implementation.md`, `review.md`,
`qa-report.md`, `delivery.md`, `state.json`, `log.md`.

Durable cross-run memory is an **[Obsidian](https://obsidian.md/)-structured vault** in `vault/`
(`[[wikilinks]]` + `#tags` + a graph) — the team's *company brain*, grown automatically by the
upskilling cycle. Open it in Obsidian, or run `python3 scripts/vault_graph.py`.

The pipeline, phases, gates, and feedback loops are defined in
[`workflow/SOP.md`](workflow/SOP.md). Read it before acting.

## Skills

Roles pull in reusable skills in [`skills/`](skills/) (installed into `.claude/skills/` by the
sync script): **ponytail** (minimal change, no over-engineering), **karpathy-coding-guidelines**,
**systematic-debugging**, and **graphify** (codebase → knowledge graph; needs `pip install graphifyy`).
The **superpowers** plugin (brainstorming, TDD, verification) is available in Claude Code. See
[`skills/README.md`](skills/README.md).

## Orchestration directive (for the active agent)

When the user asks you to build, implement, design, or fix something in this project:

1. **Act as `orchestrator-pm`** (see `agents/orchestrator-pm.md`).
2. If `.devteam/` does not exist, create it and seed it from `workflow/blackboard/`.
3. Follow `workflow/SOP.md`: write the spec + plan, then advance phase by phase.
4. For each phase, **adopt the matching role file** (Cursor) or **dispatch the matching
   subagent** (Claude Code `Task` tool), passing only the blackboard as context.
5. Enforce the gates. On review/QA failure, loop back to the developer (max 3 rounds).
6. Keep `state.json` and `log.md` current on every handoff.
7. Stop at the merge gate and report what shipped and any open assumptions.

## Repo map

```
agents/              Canonical role definitions (source of truth)
skills/              Reusable skills (ponytail, systematic-debugging, karpathy, graphify)
workflow/SOP.md      The pipeline every harness follows
workflow/blackboard/ Templates for the shared coordination files
.claude/             Generated Claude Code subagents + skills + /devteam command
.cursor/rules/       Generated Cursor rules (one per role + orchestrator)
crew/                Autonomous CrewAI engine (loads agents/ at runtime)
scripts/             sync_harnesses.py — regenerates .claude and .cursor from agents/ + skills/
```

> Edit roles in **`agents/`** only, then run `python3 scripts/sync_harnesses.py` to
> regenerate the harness-specific copies. `agents/` is the single source of truth.
