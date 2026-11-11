# Chapters — the craft axis of the squads × chapters matrix

> **Squads** (Atlas / Nova / Orion / Platform / Leadership) own delivery end-to-end.
> **Chapters** group every specialist of a craft *across* squads to set standards and make
> discipline-wide decisions. Each person has a **squad** (where they sit and ship) and a
> **chapter** (their craft community, led by a chapter lead).

| Chapter | Roles in it | Chapter lead | Owns |
|---------|-------------|--------------|------|
| Product | orchestrator-pm | Head of Product | Prioritization, scope, delivery flow |
| Design | designer | Head of Design | UX patterns, design system, a11y bar |
| Architecture (Guild) | architect | Principal Architect | Contracts, data standards, ADRs |
| Engineering | developer | Director of Engineering | Code standards, libraries, review bar |
| Quality | reviewer, qa | QA Lead | Test strategy, definition of done, evals |
| Platform | integrator | DevOps Lead | CI/CD, release, environments |

## How decisions flow (both axes)
- **Within a chapter (craft):** the chapter sets standards and resolves discipline questions;
  the chapter lead decides and records it under *Standards* below. Example: the Design chapter
  agrees the token scale; every squad's designer then follows it.
- **Across squads (delivery):** a feature flows squad-internally
  PM → architect → designer → developer → reviewer → qa → integrator, with squad-to-squad
  handoffs via `mailbox.md`.
- **Cross-cutting / risky:** anything spanning chapters or squads — or needing spend / scope /
  destructive approval — escalates to the leadership council via `approvals.md`.

## Standards (owned by each chapter)
### Product
-
### Design
-
### Architecture
-
### Engineering
-
### Quality
-
### Platform
-
