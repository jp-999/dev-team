# Standard Operating Procedure (SOP)

This is the pipeline the team follows in **every** harness (Cursor, Claude Code, or the
CrewAI engine). The orchestrator drives it; every other role does one job and hands back.

## The blackboard

All coordination happens through shared files in a `.devteam/` directory at the root of the
project the team is working on. No role calls another directly — they read and write these
files. Templates live in `workflow/blackboard/` and are copied into `.devteam/` at the start
of a run.

| File | Owner | Purpose |
|------|-------|---------|
| `spec.md` | orchestrator-pm | Problem, goals, user stories, acceptance criteria, assumptions |
| `tasks.yaml` | orchestrator-pm | Ordered task list with owner, deps, status |
| `architecture.md` | architect | Components, interfaces, data model, decisions |
| `design.md` | designer | User flows, screens/states, components, tokens, a11y |
| `implementation.md` | developer | What was built, files changed, how to run |
| `review.md` | reviewer | Findings + APPROVED / CHANGES REQUESTED |
| `qa-report.md` | qa | Test plan, results, PASS / FAIL |
| `delivery.md` | integrator | Build/smoke result, run/deploy steps |
| `state.json` | orchestrator-pm | Phase, owner, gates, revisions, autonomy, approvals, circuit-breaker |
| `log.md` | everyone | Append-only **event log** (replay/resume) |
| `memory.md` | everyone | Durable project memory ("company brain") — read before, append after |
| `mailbox.md` | orchestrator-pm (router) | Agent-to-agent messages (no direct calls) |
| `approvals.md` | orchestrator-pm | Human-in-the-loop approval queue |
| `chapters.md` | chapter leads | Craft chapters: roster, leads, standards (the matrix) |

## The pipeline

```
request → PM ─┬─► Architect ─┐
              └─► Designer ──┴─► Developer → Reviewer → QA → Integrator → PM (merge gate) → done
                                   ▲                        │
                                   └──── fix loop (≤3) ◄─────┘
```

### Phases & gates
1. **spec** (PM) — write `spec.md`. Gate: acceptance criteria are testable.
2. **plan** (PM) — write `tasks.yaml`. Gate: every task has an owner + deps.
3. **design** (Architect + Designer, parallel) — write `architecture.md` and `design.md`.
   Gate: every acceptance criterion maps to a contract and (if UI) a flow.
4. **build** (Developer) — implement; write `implementation.md`. Gate: builds + self-tested.
5. **review** (Reviewer) — write `review.md`. Gate: no blocker/major findings open.
6. **qa** (QA) — write `qa-report.md`. Gate: all acceptance criteria tested and passing.
7. **deliver** (Integrator) — write `delivery.md`. Gate: cold build + smoke test pass.
8. **merge** (PM) — verify acceptance criteria; make the final call.

### Handoff protocol (every role, every step)
1. Read your inputs from the blackboard.
2. Do your one job; write your output file.
3. Update `state.json`: `phase`, `current_owner` (next role), and any gate flags.
4. Append one line to `log.md`: `TIMESTAMP role → next_role: summary`.

### Feedback loops
- Reviewer `CHANGES REQUESTED` or QA `FAIL` → back to **developer**; PM increments
  `state.json.revisions`. After 3 rounds on the same task, PM escalates to the human.

## Org model: squads × chapters (matrix)

The team runs on **two axes** so decisions flow both across teams and within a craft:

- **Squads** own delivery end-to-end (Atlas / Nova / Orion / Platform, plus Leadership). A feature
  flows inside a squad PM → architect → designer → developer → reviewer → qa → integrator.
- **Chapters** group each craft *across* squads (Product, Design, Architecture, Engineering,
  Quality, Platform) to set standards and make discipline-wide calls, led by a chapter lead.

Decision flow: **within a chapter** (craft standards; chapter lead decides) · **across squads**
(feature handoffs via `mailbox.md`) · **cross-cutting/risky** (escalate to the leadership council
via `approvals.md`). Full roster, leads, and standards live in `chapters.md`.

## Adopted best practices (deep dive: Munder Difflin, CrewAI, OpenHuman, Muse Code, Keystroke, Relevance AI)

- **Plan → Grill → Goal** (Muse Code). The PM writes an explicit plan; the architect/reviewer
  **grill** it for unstated assumptions and missing edge cases; then the team runs
  goal-conditioned until acceptance is met. A new `grill` gate sits between `plan` and `design`.
- **Autonomy + human approval gates + circuit breaker** (Relevance / Keystroke / Munder).
  `state.json.autonomy` is `auto | ask | escalate`. Spend, scope changes, destructive/prod ops,
  external side effects, and new dependencies go to `approvals.md` and pause the task. A
  steer → constrain → stop breaker halts loops/runaways; `max_revisions` is the hard stop.
- **Memory / company brain** (OpenHuman / Keystroke). Every role reads `memory.md` before acting
  and appends durable decisions and learnings after — knowledge survives across runs.
- **Mailbox routing** (Munder hive). Cross-role messages go through `mailbox.md`; the orchestrator
  delivers and recipients drain. No agent calls another directly.
- **Append-only event log + resume** (Muse Code / OpenHuman). `log.md` is the replayable source of
  truth; a run resumes by reading its tail.
- **Ticket keys + traces** (Munder / Keystroke). Every task carries a `DT-###` key used across the
  log, mailbox, and approvals for a full per-ticket trace.
- **Triggers + evals + retro** (Keystroke / Relevance). Runs can start from a webhook/schedule/Slack
  trigger; QA treats acceptance criteria as scored **evals**; a short **retro** feeds `memory.md`.

## Proportionality
Not every change needs all phases. The PM scales the pipeline:
- **Trivial** (typo, copy, config): PM → Developer → done.
- **Small** (one component, no UI): skip Designer.
- **Full** (feature, UI, risk): run the whole pipeline.
