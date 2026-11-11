# AI Development Team

A coordinated team of AI agents — **PM/Orchestrator, Architect, Designer, Developer,
Reviewer, QA, and DevOps/Integrator** — that take a request from idea to a shippable change.

The same role definitions run three ways:

1. **Cursor** — as rules + an orchestrator directive
2. **Claude Code** — as subagents + a `/devteam` command
3. **CrewAI** — as an autonomous Python engine

This document explains **how everything works** and **how to install and run it**.

---

## Quick start — after you clone from GitHub

```bash
git clone https://github.com/jp-999/dev-team.git
cd dev-team
```

Then pick how you want to run the team:

**Cursor** — open the folder in Cursor and just ask it to build something (*"Build a URL
shortener with a web UI"*). The rules in `.cursor/rules/` and `AGENTS.md` load automatically;
nothing to install.

**Claude Code** — two ways:
- *Inside this repo:* open the folder in Claude Code. The subagents in `.claude/agents/` and the
  `/devteam` command load automatically — run `/devteam build a URL shortener`.
- *From any project (connect it user‑wide, do this once):*
  ```bash
  python3 scripts/sync_harnesses.py --user
  ```
  This copies the 7 role subagents, the skills, and the `/devteam` command into `~/.claude/`
  (the command is written with *your* clone's absolute path, so it works from anywhere). Start a
  **new** Claude Code session, type `/agents` to see the team, or run `/devteam …`. You can also
  just say *"use the reviewer subagent on these changes"* — roles dispatch via the Task tool.

**CrewAI (autonomous engine)** — needs Python 3.10–3.13 and an LLM API key:
```bash
# macOS/Homebrew example; any Python 3.10–3.13 works
/opt/homebrew/bin/python3.13 -m venv crew/.venv
cd crew && ./.venv/bin/python -m pip install -e . && cp .env.example .env   # then add your key
./.venv/bin/python -m devteam.main "Build a URL shortener"
```

**Office view (optional, zero‑install):** `cd office && python3 -m http.server 8011`, then open
http://localhost:8011/.

Detailed instructions for each are below.

---

## 1. The idea in one picture

There is **one source of truth** — the role definitions in [`agents/`](agents/) — and three
consumers that all read it. Roles never call each other directly; they coordinate through a
shared **blackboard** of files.

```
                         agents/*.md  (single source of truth)
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
   .cursor/rules/         .claude/agents/           crew/  (CrewAI)
   (Cursor)               + /devteam (Claude Code)  autonomous engine
          └──────────────────────┼──────────────────────┘
                                 ▼
                    .devteam/  (shared blackboard)
          spec · tasks · architecture · design · implementation
          review · qa-report · delivery · state · log
```

Pipeline (full version; the PM scales it down for small changes):

```
request → PM ─┬─► Architect ─┐
              └─► Designer ──┴─► Developer → Reviewer → QA → Integrator → PM (merge) → done
                                   ▲                        │
                                   └──── fix loop (≤3) ◄─────┘
```

See [`workflow/SOP.md`](workflow/SOP.md) for the full pipeline, phases, and gates, and
[`AGENTS.md`](AGENTS.md) for the operating manual that Cursor and Claude Code read.

---

## 2. The team

| # | Role | Canonical file | Owns | Writes to blackboard |
|--:|------|----------------|------|----------------------|
| 1 | PM / Orchestrator | `agents/orchestrator-pm.md` | Scope, plan, coordination, merge gate | `spec.md`, `tasks.yaml`, `state.json` |
| 2 | Architect | `agents/architect.md` | Interfaces, data model, decisions | `architecture.md` |
| 3 | Designer (UX) | `agents/designer.md` | Flows, screens, components, tokens | `design.md` |
| 4 | Developer | `agents/developer.md` | Implementation | code + `implementation.md` |
| 5 | Code Reviewer | `agents/reviewer.md` | Correctness, security, quality | `review.md` |
| 6 | QA / Tester | `agents/qa.md` | Tests + acceptance verification | tests + `qa-report.md` |
| 7 | DevOps / Integrator | `agents/integrator.md` | Build, integrate, release readiness | `delivery.md` |

Each role file has YAML frontmatter (`name`, `description`, `goal`, `model`, `tools`,
`reads`, `writes`, `handoff_to`) and a markdown body that is the agent's instructions.

---

## 3. How coordination works

- **Blackboard:** a `.devteam/` directory at the root of the project being built. Templates
  live in [`workflow/blackboard/`](workflow/blackboard/) and are copied into `.devteam/` at
  the start of a run.
- **Handoff protocol:** each role reads its inputs, does one job, writes its artifact, updates
  `state.json` (phase + current owner + gates), and appends one line to `log.md`.
- **Gates:** the PM only advances when the current phase's gate is met (spec testable, plan
  complete, design maps to criteria, build passes, review clean, QA green, cold build +
  smoke OK). Review/QA failures loop back to the developer (max 3 rounds, then escalate).

This is the orchestrator + handoff + shared-state (blackboard) pattern used by mature
multi-agent dev frameworks (MetaGPT, ChatDev, waterfall).

---

## 4. Installation

### 4.1 Prerequisites
- macOS (Apple Silicon) with [Homebrew](https://brew.sh).
- For **Cursor** / **Claude Code**: just open this folder — no install needed.
- For the **CrewAI engine**: Python 3.13 (set up below) and an LLM API key.

### 4.2 Python (already done on this machine, documented for reproducibility)

> **Why two versions?** The latest Python is **3.15.2** and is now your default `python3`.
> But **CrewAI requires `Python >=3.10, <3.14`**, so the autonomous engine runs on an
> isolated **3.13** virtualenv. The two never conflict — the venv is self-contained.

What was installed:

```bash
# Latest Python (default) + the version CrewAI supports
brew install python@3.15 python@3.13

# Make Homebrew's Python the default python3 in new shells
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
# open a new terminal, then:
python3 --version          # => Python 3.15.2
```

| Purpose | Version | Location |
|---------|---------|----------|
| Default `python3` (latest) | 3.15.2 | `/opt/homebrew/bin/python3` |
| CrewAI engine (`crew/.venv`) | 3.13.18 | `/opt/homebrew/bin/python3.13` |

### 4.3 CrewAI engine

```bash
cd crew
# Create the venv if it doesn't exist yet:
#   /opt/homebrew/bin/python3.13 -m venv .venv
./.venv/bin/python -m pip install -e .     # installs crewai + the devteam CLI
cp .env.example .env                        # then add your API key (see below)
```

Set your model and key in `crew/.env`:

```ini
DEVTEAM_MODEL=gpt-4o-mini          # or anthropic/claude-sonnet-4-5
OPENAI_API_KEY=sk-...              # key for whichever provider the model uses
```

---

## 5. Usage

### 5.1 Cursor
Open this folder in Cursor and ask, e.g. *"Build a URL shortener with a web UI."* The agent
reads `AGENTS.md`, acts as the orchestrator, and applies the per-role rules in
`.cursor/rules/` as it moves through the pipeline, coordinating via `.devteam/`.

### 5.2 Claude Code

**A) Inside this repo.** Open the folder in Claude Code and run:

```
/devteam Build a URL shortener with a web UI
```

The orchestrator delegates each phase to the matching subagent in `.claude/agents/` via the
Task tool. (Or just describe the task and it will act as the orchestrator per `CLAUDE.md`.)

**B) Connect the whole team to Claude Code user‑wide (use it in any project).** Run once:

```bash
python3 scripts/sync_harnesses.py --user
```

This installs, into `~/.claude/` (your logged‑in Claude Code, available everywhere):

- **7 role subagents** → `~/.claude/agents/` — `orchestrator-pm`, `architect`, `designer`,
  `developer`, `reviewer`, `qa`, `integrator`.
- **`/devteam` command** → `~/.claude/commands/devteam.md` — written with this clone's absolute
  path, so it runs the pipeline from any directory.
- **Skills** → `~/.claude/skills/` — adds `ponytail`, `karpathy-coding-guidelines`,
  `systematic-debugging` (any skill you already have, e.g. `graphify`, is left untouched).

Then:

- Start a **new** Claude Code session so it picks up the user‑level agents.
- Type `/agents` to see the team listed, or run `/devteam build a URL shortener`.
- Or ask directly: *"use the reviewer subagent on these changes"* — roles dispatch via the Task tool.
- **Repeatable:** re‑run `python3 scripts/sync_harnesses.py --user` any time you edit a role in
  `agents/` to refresh the user‑level copies.

> Same‑named project‑level agents take precedence inside this repo, so behavior is identical
> whether you're in the repo or elsewhere — no conflicts.

### 5.3 CrewAI (autonomous)

```bash
cd crew
./.venv/bin/python -m devteam.main --plan                    # show the pipeline, no LLM calls
./.venv/bin/python -m devteam.main "Build a URL shortener"   # run the whole team
# or, with the venv active, simply:  devteam "Build a URL shortener"
```

Outputs land in `./.devteam/` — one artifact per role.

---

## 6. Customizing the team

Everything flows from `agents/`. To change a role, add one, or remove one:

1. Edit (or add) a file in [`agents/`](agents/) — keep the frontmatter shape.
2. Regenerate the harness copies:

   ```bash
   python3 scripts/sync_harnesses.py
   ```

   This rewrites `.claude/agents/` and `.cursor/rules/`. The CrewAI engine reads `agents/`
   directly, so it needs no regeneration. If you add a role, also add it to the handoff
   graph `DEPENDENCIES` in `crew/devteam/roles.py`.

---

## 7. Repo map

```
agents/                 Canonical role definitions (SOURCE OF TRUTH)
workflow/
  SOP.md                The pipeline every harness follows
  blackboard/           Templates for the shared coordination files
AGENTS.md               Cross-harness operating manual (Cursor + Claude Code read this)
CLAUDE.md               Claude Code entry (imports AGENTS.md)
.claude/
  agents/               Generated Claude Code subagents
  commands/devteam.md   /devteam slash command
.cursor/rules/          Generated Cursor rules (orchestrator + one per role)
crew/                   Autonomous CrewAI engine
  devteam/              roles.py (loader) · crew.py (builder) · main.py (CLI)
  pyproject.toml        Pins Python >=3.10,<3.14 (CrewAI constraint)
  .venv/                Python 3.13 virtualenv
scripts/
  sync_harnesses.py     Regenerates .claude and .cursor from agents/
                        (add --user to also install into ~/.claude for any project)
```

---

## 8. Office view (local frontend)

A zero-install visual of the team as a living office — **everyone on the work they're assigned**,
with desks, two conference rooms, a war room (decision council), and a cafeteria. People show
their current task + progress, talk within and across teams, and gather for stand-ups, reviews,
and decisions. See [`office/`](office/).

```bash
cd office && python3 -m http.server 8011    # then open http://localhost:8011/
# or simply open office/index.html directly
```

It's a local **simulation** today, structured to later bind to the real `.devteam/` blackboard.

## 9. Skills & external tools

Roles pull in reusable skills, vendored in [`skills/`](skills/) and installed into `.claude/skills/`
by `scripts/sync_harnesses.py`:

- **ponytail** (minimal change, no over-engineering) — Developer, Architect, Reviewer
- **systematic-debugging** (root-cause first) — Developer, Reviewer, QA
- **karpathy-coding-guidelines** (think first, stay surgical) — all build/quality roles
- **graphify** (codebase → knowledge graph) — Architect, Developer

Referenced, not vendored: **superpowers** ([obra/superpowers](https://github.com/obra/superpowers)),
the Claude Code skills framework, already present in this machine's plugin cache.

**Optional requirement — only needed to actually run graphify:**

```bash
pip install graphifyy && graphify install
```

See [`skills/README.md`](skills/README.md) for the full catalog and per-harness install.

## 10. Notes & troubleshooting

- **"CrewAI won't install on 3.14/3.15"** — expected. Use the 3.13 venv; that's why it exists.
- **Changing default Python back** — remove the `brew shellenv` line from `~/.zprofile`.
- **No API key?** `--plan` and all the Cursor/Claude Code flows work without one; only the
  autonomous CrewAI *run* needs a key.
- **Design rationale & framework comparison** — see the landscape canvas:
  `.cursor/projects/.../canvases/ai-dev-team-landscape.canvas.tsx` (open it beside the chat).
