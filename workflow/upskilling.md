# Upskilling (L&D) — the automatic 12-hour improvement cycle

The Upskilling team — **Researcher, Training Lead, People/HR, Compliance** — runs on a
**12-hour schedule**. It is **not** a manual step; it fires on its own, finds improvements, and
rolls them out to every squad so the whole dev team keeps getting better.

## Cadence (automatic)
- **Office view:** an upskilling cycle fires every 12 *simulated* hours (no button) — watch the
  L&D room light up and the "L&D · N" counter tick as improvements ship org-wide.
- **Real automation:** `scripts/upskill.py` runs every 12 *real* hours via a launchd job at
  `~/Library/LaunchAgents/com.devteam.upskill.plist` (installed by the setup; see the README).

## The cycle
1. **Researcher** scans tools, papers, and practices → writes `upskilling-report.md` (findings).
2. **Training Lead** picks the best improvement and distills it into a playbook; folds it into
   `memory.md` and the relevant `chapters.md` standard.
3. **People / HR** turns it into a lightweight growth plan and checks team health.
4. **Compliance** verifies security / licensing / policy; clean ones are adopted, risky ones go to
   `approvals.md` for a human.
5. **orchestrator-pm** closes the cycle; the improvement is now inherited by every squad's next run.

## Outputs
- `upskilling-report.md` — per-cycle findings + the one improvement adopted.
- Appends to `memory.md` and the owning chapter's standards in `chapters.md`.
- Any risky adoption → `approvals.md`.
