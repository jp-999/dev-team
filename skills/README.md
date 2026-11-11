# Skills

Reusable, harness-agnostic skills the team's roles pull in. Canonical copies live here; the
sync script installs them where each harness looks (`.claude/skills/` for Claude Code). Cursor
and the CrewAI roles reference them through `AGENTS.md` and the role files.

| Skill | Source | What it adds | Used by |
|-------|--------|--------------|---------|
| `ponytail` | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (MIT) | Lazy-senior-dev discipline: smallest change that fully solves the task, never cut validation/security/tests | Developer, Architect, Reviewer |
| `systematic-debugging` | [ChrisWiles/claude-code-showcase](https://github.com/ChrisWiles/claude-code-showcase) | Root-cause-first, four-phase debugging | Developer, Reviewer, QA |
| `karpathy-coding-guidelines` | [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) | Think-before-coding, simplicity, surgical changes, goal-driven execution | all build/quality roles |
| `graphify` (pointer) | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | Codebase → queryable knowledge graph (needs the `graphifyy` engine) | Architect, Developer |

## External frameworks (reference, not vendored)

- **superpowers** — [obra/superpowers](https://github.com/obra/superpowers), the Claude Code skills
  framework (brainstorming, TDD, verification-before-completion, requesting/receiving code review).
  Already present on this machine via the official plugin cache (v7.0.0). In Claude Code it's
  available as a plugin; install/enable with:
  ```
  /plugin marketplace add obra/superpowers
  /plugin install superpowers@superpowers
  ```
  The PM/Orchestrator uses **brainstorming** before new features; Developer/QA use **TDD** and
  **verification-before-completion**.

## Optional tooling (adds a real dependency)

- **graphify engine** — `pip install graphifyy && graphify install`. Only needed to actually run
  `graphify`; the pointer skill above degrades gracefully to `Grep`/`Glob` if it's absent.

### Install status (this machine)
- ✅ **graphify** `0.9.106` installed in `crew/.venv`; `/graphify` skill installed at `~/.claude/skills/graphify`.
- ✅ **ponytail** plugin registered via `claude` (`ponytail@ponytail`, user scope) — `/ponytail-review`, `/ponytail-audit`, etc.
- ✅ **superpowers** already enabled as `superpowers@claude-plugins-official` v7.0.0 (the `obra/superpowers` marketplace is also added).

## How these are installed

Edit a skill here, then run `python3 scripts/sync_harnesses.py`. The sync copies each
`skills/<name>/SKILL.md` into `.claude/skills/<name>/SKILL.md` (Claude Code auto-discovers them).
Cursor and the CrewAI engine read them via the references in `AGENTS.md` and the role files.
