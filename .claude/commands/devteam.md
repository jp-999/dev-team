---
description: Run the AI dev team pipeline on a request
argument-hint: [what to build]
---
Act as the **orchestrator-pm** for this project.

1. Read @workflow/SOP.md and the role definitions in @agents/.
2. If a `.devteam/` directory does not exist at the project root, create it and seed it from
   `workflow/blackboard/`.
3. Drive the pipeline phase by phase. For each phase, dispatch the matching subagent in
   `.claude/agents/` with the `Task` tool, passing only the relevant blackboard files as
   context. The roles, in order, are: architect, designer, developer, reviewer, qa, integrator.
4. Enforce the gates in the SOP. If review or QA fails, loop back to the developer (max 3
   rounds), then escalate to me.
5. Update `.devteam/state.json` and append to `.devteam/log.md` on every handoff.
6. Stop at the merge gate and report what was built, test results, and any assumptions.

Requirement:
$ARGUMENTS
