# Event log (append-only · replay/resume)

The single source of truth for what happened. Every handoff, gate, approval, and decision is
appended here and never rewritten — so a run can be resumed after an interruption by reading
the tail. (Adopted from Muse Code / OpenHuman / Munder event logs.)

Format: `TIMESTAMP  role → next_role: one-line summary`

<!-- Example:
2026-11-11T21:30:00  orchestrator-pm → architect,designer: spec + plan ready, 3 user stories
2026-11-11T21:45:00  architect → developer: contracts + data model done
-->
