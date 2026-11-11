# Office view (local frontend)

A zero-install, top-down view of the AI dev team as a living office. The focal point is simple:
**everyone is on the work they've been assigned** — each person shows their current task and a
live progress bar at their desk, and gets pulled into stand-ups, reviews, and the decision
council in the conference rooms and war room. People talk within and across teams, and the
activity feed logs it all.

## Run it

**Option A — just open the file** (no server needed):

```
open index.html        # macOS
```

**Option B — local server:**

```
cd office
python3 -m http.server 8011
# then open http://localhost:8011/
```

## What you'll see

- **Desks (team pods):** Leadership, Team Atlas, Team Nova, Team Orion, and Platform. Everyone
  has a name, role, and years of experience (all 3+; leads and leadership are more senior).
- **Rooms:** two conference rooms (Everest, Fuji), the War Room (decision council), a Cafeteria,
  a Lobby, and a Focus Zone.
- **Everyone working their assignment:** a status (Coding / Reviewing / Testing / Designing /
  Planning / Shipping) and a progress bar that advances; when a task finishes it's logged and a
  new one is assigned.
- **Conversations:** speech bubbles + an activity feed, within teams and cross-team.
- **Meetings:** stand-ups, design/architecture reviews, lunch, and the **decision council** —
  where the six most senior people deliberate and land a decision with a consensus and confidence.

## Controls
- **Pause / Resume**, **speed** (1×/2×/4×)
- **Highlight a team** (dims the rest)
- **Call stand-up** and **Convene council** to trigger events on demand
- Click any **person** or **room** to inspect them in the right panel.

## Customize
Everything is data-driven. Edit [`data.js`](data.js):
- `PEOPLE` — names, roles, teams, experience, bios
- `ROOMS` — the floor plan (coordinates in a 1200×700 space)
- `TASKS_BY_ROLE`, `SAY`, `DECISIONS` — the work, the chatter, and the council's questions

> This is a local **simulation** for now. It's structured so it can later be driven by the real
> `.devteam/` blackboard (live task status from actual agent runs) instead of the simulated loop.
