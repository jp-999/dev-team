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
| `state.json` | orchestrator-pm | Current phase, owner, gates, revision counts |
| `log.md` | everyone | Append-only one-line handoff log |

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

## Proportionality
Not every change needs all phases. The PM scales the pipeline:
- **Trivial** (typo, copy, config): PM → Developer → done.
- **Small** (one component, no UI): skip Designer.
- **Full** (feature, UI, risk): run the whole pipeline.
