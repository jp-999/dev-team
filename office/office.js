/* Pixel-art office — a real walled floor plan rendered on canvas.
 * Walls + doorways, detailed desks/computers/office chairs, a cafeteria with appliances,
 * decor, ceiling-light glow, richer characters with name plates, and live activity labels.
 * Vanilla JS, no deps, runs from file://. Depends on globals in data.js.
 * Procedural art only (no external tilesets). Vibe inspired by munder-difflin. */
(function () {
  "use strict";

  const TILE = 16, GRID_W = 56, GRID_H = 36, LOGW = GRID_W * TILE, LOGH = GRID_H * TILE;
  const S_INTERNAL = 2, MIN_PER_SEC = 3;

  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const randint = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const first = (n) => n.split(" ")[0];
  const initials = (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colorOf = (role) => TRACK_COLORS[(ROLES[role] || {}).track] || "#8891a5";
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = randint(0, i);[a[i], a[j]] = [a[j], a[i]]; } return a; };

  const TEAM_COLORS = { leadership: "#64748b", atlas: "#3b82f6", nova: "#a855f7", orion: "#ef7a3b", platform: "#10b981" };

  // Rooms are walled (perimeter walls with carved doorways). (tx,ty,tw,th) = interior floor.
  const ROOMS_DEF = [
    { id: "leadership", team: "leadership", kind: "team", label: "LEADERSHIP", tx: 1, ty: 1, tw: 13, th: 10 },
    { id: "allhands", kind: "meeting", label: "ALL-HANDS", tx: 15, ty: 1, tw: 16, th: 10 },
    { id: "atlas", team: "atlas", kind: "team", label: "TEAM ATLAS", tx: 32, ty: 1, tw: 23, th: 10 },
    { id: "nova", team: "nova", kind: "team", label: "TEAM NOVA", tx: 1, ty: 12, tw: 26, th: 10 },
    { id: "orion", team: "orion", kind: "team", label: "TEAM ORION", tx: 28, ty: 12, tw: 27, th: 10 },
    { id: "platform", team: "platform", kind: "team", label: "PLATFORM", tx: 1, ty: 23, tw: 16, th: 12 },
    { id: "cafeteria", kind: "cafeteria", label: "CAFETERIA · THE HUB", tx: 18, ty: 23, tw: 18, th: 12 },
    { id: "lounge", kind: "lounge", label: "LOUNGE", tx: 37, ty: 23, tw: 18, th: 12 },
  ];
  const roomById = (id) => ROOMS_DEF.find((r) => r.id === id);
  const MEETING_ROOM = { standup: null, design: "allhands", arch: "allhands", council: "leadership", lunch: "cafeteria" };
  const DOORS = [
    { x: 14, y: 5 }, { x: 14, y: 6 }, { x: 31, y: 5 }, { x: 31, y: 6 },
    { x: 27, y: 16 }, { x: 27, y: 17 }, { x: 17, y: 28 }, { x: 17, y: 29 }, { x: 36, y: 28 }, { x: 36, y: 29 },
    { x: 7, y: 11 }, { x: 8, y: 11 }, { x: 22, y: 11 }, { x: 23, y: 11 }, { x: 45, y: 11 }, { x: 46, y: 11 },
    { x: 9, y: 22 }, { x: 10, y: 22 }, { x: 30, y: 22 }, { x: 31, y: 22 }, { x: 46, y: 22 }, { x: 47, y: 22 },
  ];

  const FILES = ["PixelPanel.tsx", "Avatar.tsx", "hive.ts", "router.ts", "memory.ts", "Board.tsx", "office.ts", "api.ts", "floor.ts"];
  const ACTIVITIES = {
    developer: ["editing {file}", "running tests", "fixing {f}", "compiling", "pushing a commit", "wiring the API", "updating the todo board"],
    senior_dev: ["refactoring {f}", "pairing on {f}", "profiling", "hardening {f}", "reviewing a branch"],
    reviewer: ["reviewing PR #{n}", "searching for skill files", "leaving comments", "checking security", "reading the diff"],
    qa: ["running tests", "reproducing #{n}", "writing a test", "verifying criteria", "filing a bug"],
    designer: ["editing {file}", "updating tokens", "sketching a flow", "fetching docs", "polishing states"],
    head_design: ["reviewing designs", "evolving the system", "critiquing a flow"],
    architect: ["editing the schema", "drawing the diagram", "writing an ADR", "fetching docs", "spiking {f}"],
    principal_architect: ["reviewing contracts", "writing an ADR", "assessing scale"],
    pm: ["updating the todo board", "grooming the backlog", "writing the spec", "fetching docs", "planning the sprint"],
    head_product: ["reviewing metrics", "prioritizing", "aligning stakeholders"],
    director: ["reviewing OKRs", "unblocking a dep", "prepping the board"],
    integrator: ["cutting a release", "smoke-testing", "updating CI", "rotating secrets", "watching the deploy"],
    devops_lead: ["reviewing the pipeline", "checking prod", "planning rollout"],
    qa_lead: ["setting test strategy", "triaging flaky tests", "reviewing coverage"],
  };
  const fillAct = (t) => t.replace("{file}", pick(FILES)).replace("{f}", pick(FEATURES)).replace("{n}", randint(120, 980));

  // ---------- canvas ----------
  const canvas = $("floor"), ctx = canvas.getContext("2d");
  function fit() {
    canvas.width = LOGW * S_INTERNAL; canvas.height = LOGH * S_INTERNAL;
    ctx.setTransform(S_INTERNAL, 0, 0, S_INTERNAL, 0, 0); ctx.imageSmoothingEnabled = false;
    const stage = $("stage"), sw = stage.clientWidth || LOGW, sh = stage.clientHeight || LOGH;
    const scale = Math.min(sw / LOGW, sh / LOGH);
    canvas.style.width = Math.max(1, Math.floor(LOGW * scale)) + "px";
    canvas.style.height = Math.max(1, Math.floor(LOGH * scale)) + "px";
  }

  // ---------- state ----------
  const S = {
    people: [], byId: {}, wall: null, lights: [], auto: true, speed: 2, simMin: 9 * 60, day: 1, shippedToday: 0,
    filter: "all", chapterFilter: "all", selected: null, selectedKind: null, hover: null, time: 0,
    meetings: [], talks: [], envelopes: [], ticketSeq: 100, approvals: 0,
    nextStandup: 9 * 60 + 25, nextReview: 9 * 60 + 80, nextDecision: 9 * 60 + 140, nextChapter: 9 * 60 + 55, lunchDone: false, standupIdx: 0, chapterIdx: 0,
  };

  // ---------- content ----------
  const fillTask = (t) => t.replace("{f}", pick(FEATURES)).replace("{n}", randint(120, 940));
  function assignTask(p) {
    p.task = fillTask(pick(TASKS_BY_ROLE[p.role] || ["Working on {f}"])); p.progress = rand(2, 22);
    p.rate = (0.5 + p.years / 24) * rand(0.8, 1.3); p.status = "starting"; p.startTimer = rand(2, 4.5);
    p.ticket = "DT-" + (++S.ticketSeq); p.activity = fillAct(pick(ACTIVITIES[p.role] || ["working"])); p.actTimer = rand(4, 8);
  }
  const statusWord = (p) => p.walking ? ("heading to " + (p.destLabel || "desk")) : p.status === "working" ? p.activity : (STATUS_WORDS[p.status] || "working");
  function statusKindClass(p) {
    if (p.status === "meeting") return "s-meeting"; if (p.status === "break") return "s-break";
    if (p.role === "reviewer") return "s-review"; if (p.role === "qa" || p.role === "qa_lead") return "s-testing";
    return "s-working";
  }
  const roleVerb = (role) => (ACTIVITIES[role] ? "working" : "working");

  // ---------- build ----------
  function placeDesks(area, n) {
    const cols = Math.min(n, Math.max(2, Math.round(area.w / 4))), rows = Math.ceil(n / cols);
    const stepX = area.w / cols, stepY = area.h / rows, out = [];
    for (let i = 0; i < n; i++) { const c = i % cols, rr = Math.floor(i / cols); out.push({ tx: Math.round(area.x + stepX * (c + 0.5) - 1), ty: Math.round(area.y + stepY * rr + 0.5) }); }
    return out;
  }
  function buildWalls() {
    const w = Array.from({ length: GRID_H }, () => new Array(GRID_W).fill(false));
    for (let x = 0; x < GRID_W; x++) { w[0][x] = true; w[GRID_H - 1][x] = true; }
    for (let y = 0; y < GRID_H; y++) { w[y][0] = true; w[y][GRID_W - 1] = true; }
    ROOMS_DEF.forEach((r) => {
      for (let x = r.tx - 1; x <= r.tx + r.tw; x++) { if (x >= 0 && x < GRID_W) { w[clamp(r.ty - 1, 0, GRID_H - 1)][x] = true; w[clamp(r.ty + r.th, 0, GRID_H - 1)][x] = true; } }
      for (let y = r.ty - 1; y <= r.ty + r.th; y++) { if (y >= 0 && y < GRID_H) { w[y][clamp(r.tx - 1, 0, GRID_W - 1)] = true; w[y][clamp(r.tx + r.tw, 0, GRID_W - 1)] = true; } }
    });
    DOORS.forEach((d) => { if (w[d.y]) w[d.y][d.x] = false; });
    return w;
  }
  function build() {
    S.wall = buildWalls();
    S.lights = ROOMS_DEF.map((r) => ({ x: (r.tx + r.tw / 2) * TILE, y: (r.ty + r.th / 2) * TILE, rad: Math.max(r.tw, r.th) * TILE * 0.7 }));
    ROOMS_DEF.forEach((r) => { if (r.kind !== "team") return; r.cooler = { x: (r.tx + r.tw - 1) * TILE + 6, y: (r.ty + r.th - 1) * TILE + 2 }; });
    ROOMS_DEF.forEach((z) => {
      if (z.kind !== "team") return;
      const members = PEOPLE.filter((p) => p.team === z.team);
      const area = { x: z.tx + 1, y: z.ty + 4, w: z.tw - 2, h: z.th - 5 };
      const slots = placeDesks(area, members.length);
      members.forEach((person, i) => {
        const s = slots[i] || slots[slots.length - 1];
        const hx = s.tx * TILE + 15, hy = s.ty * TILE + 30, idx = PEOPLE.indexOf(person);
        const p = Object.assign({}, person, {
          deskX: s.tx * TILE + 2, deskY: s.ty * TILE + 7, x: hx, y: hy, hx: hx, hy: hy,
          path: [], pendingStatus: "working", destLabel: "desk", walking: false, facing: "up", busy: false, bob: 0, phase: rand(0, 6.28),
          skin: SKIN_TONES[idx % SKIN_TONES.length], hair: HAIR_COLORS[idx % HAIR_COLORS.length], hairStyle: idx % 6, shirt: colorOf(person.role), speed: rand(42, 62),
          chapter: ROLE_CHAPTER[person.role] || "product",
        });
        assignTask(p); S.people.push(p); S.byId[p.id] = p;
      });
    });
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onHover);
    canvas.addEventListener("mouseleave", () => { S.hover = null; });
    buildLegend(); fit(); renderInspector();
  }
  function buildLegend() {
    const squads = ROOMS_DEF.filter((r) => r.team).map((z) => '<span class="li"><span class="sw" style="background:' + TEAM_COLORS[z.team] + '"></span>' + TEAMS[z.team].name + "</span>").join("");
    const chaps = Object.keys(CHAPTERS).map((k) => '<span class="li"><span class="sw" style="background:' + CHAPTERS[k].color + ';border-radius:50%"></span>' + CHAPTERS[k].label + "</span>").join("");
    $("legend").innerHTML = '<div class="lgrp">squads · rooms</div>' + squads + '<div class="lgrp">chapters · craft</div>' + chaps;
  }

  // ---------- draw primitives ----------
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  function roundRect(x, y, w, h, rad) { ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath(); }
  function disc(x, y, rad, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill(); }
  function pill(x, y, text, bg, fg, size) { ctx.font = (size || 5) + "px ui-monospace, monospace"; const w = ctx.measureText(text).width + 6; ctx.fillStyle = bg; roundRect(x, y, w, (size || 5) + 4, 2); ctx.fill(); ctx.fillStyle = fg; ctx.fillText(text, x + 3, y + (size || 5) + 1.5); return w; }
  const isWall = (x, y) => S.wall[y] && S.wall[y][x];
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; }

  function drawFloor() {
    for (let ty = 0; ty < GRID_H; ty++) for (let tx = 0; tx < GRID_W; tx++) {
      if (isWall(tx, ty)) continue;
      r(tx * TILE, ty * TILE, TILE, TILE, (tx + ty) % 2 === 0 ? "#5e7d66" : "#63816a");
      ctx.fillStyle = "rgba(0,0,0,.05)"; ctx.fillRect(tx * TILE, ty * TILE, TILE, 1); ctx.fillRect(tx * TILE, ty * TILE, 1, TILE);
    }
    // team-tinted rugs + room floor tint
    ROOMS_DEF.forEach((rm) => {
      if (rm.team) { ctx.fillStyle = hexA(TEAM_COLORS[rm.team], 0.06); ctx.fillRect(rm.tx * TILE, rm.ty * TILE, rm.tw * TILE, rm.th * TILE); }
      if (rm.kind === "cafeteria") { ctx.fillStyle = "rgba(150,128,74,.1)"; ctx.fillRect(rm.tx * TILE, rm.ty * TILE, rm.tw * TILE, rm.th * TILE); }
    });
  }
  function drawLights() {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    S.lights.forEach((l) => { const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.rad); g.addColorStop(0, "rgba(255,240,208," + (0.1 + 0.12 * (S.glowBoost || 0)).toFixed(3) + ")"); g.addColorStop(1, "rgba(255,240,208,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, l.rad, 0, 7); ctx.fill(); });
    ctx.restore();
    S.lights.forEach((l) => { r(l.x - 5, l.y - 9, 10, 3, "#fdf3d2"); ctx.fillStyle = "rgba(253,243,210,.5)"; ctx.fillRect(l.x - 6, l.y - 9.5, 12, 4); });
  }
  function drawWalls() {
    for (let ty = 0; ty < GRID_H; ty++) for (let tx = 0; tx < GRID_W; tx++) {
      if (!isWall(tx, ty)) continue;
      const x = tx * TILE, y = ty * TILE, frontFacing = !isWall(tx, ty + 1);
      r(x, y, TILE, TILE, "#2f343d");
      r(x, y, TILE, 3, "#c7bda4"); r(x, y + 3, TILE, 1, "#1f232a"); // lit top cap
      if (frontFacing) { r(x, y + TILE - 2, TILE, 2, "#23272e"); ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(x, y + TILE, TILE, 3); }
      r(x, y, 1, TILE, "rgba(255,255,255,.04)");
    }
  }
  function drawWallDecor() {
    // fire extinguishers, whiteboards, clock mounted on interior-facing walls
    const ext = [{ x: 9, y: 1 }, { x: 44, y: 1 }, { x: 4, y: 23 }, { x: 35, y: 12 }, { x: 25, y: 23 }];
    ext.forEach((e) => { const x = e.x * TILE, y = e.y * TILE; r(x + 6, y + 4, 4, 8, "#d0392b"); r(x + 6, y + 3, 4, 2, "#111"); r(x + 7, y + 6, 2, 3, "#f4c84a"); });
    const wb = [{ x: 18, y: 1 }, { x: 33, y: 1 }];
    wb.forEach((b) => { const x = b.x * TILE, y = b.y * TILE; r(x, y + 2, 44, 11, "#eef1f4"); ctx.strokeStyle = "#8a8f98"; ctx.strokeRect(x + .5, y + 2.5, 43, 10); r(x + 3, y + 5, 18, 1.5, "#4a8"); r(x + 3, y + 8, 26, 1.5, "#48c"); r(x + 3, y + 11, 12, 1.5, "#c58"); });
    // wall clock in leadership
    disc(6 * TILE, 1 * TILE + 8, 5, "#e9e6dc"); ctx.strokeStyle = "#333"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(6 * TILE, 1 * TILE + 8); ctx.lineTo(6 * TILE, 1 * TILE + 4); ctx.moveTo(6 * TILE, 1 * TILE + 8); ctx.lineTo(6 * TILE + 3, 1 * TILE + 8); ctx.stroke();
  }

  function drawRoomsFurniture() {
    ROOMS_DEF.forEach((rm) => {
      const ix = rm.tx * TILE, iy = rm.ty * TILE, iw = rm.tw * TILE, ih = rm.th * TILE;
      // name plate
      const col = rm.team ? TEAM_COLORS[rm.team] : "#4b5563";
      ctx.fillStyle = col; roundRect(ix + 3, iy + 3, Math.min(iw - 6, rm.label.length * 4.2 + 8), 9, 2); ctx.fill();
      ctx.font = "6px ui-monospace, monospace"; ctx.fillStyle = "#fff"; ctx.fillText(rm.label, ix + 6, iy + 10);
      if (rm.kind === "meeting") confTable(rm);
      else if (rm.kind === "cafeteria") cafeteria(rm);
      else if (rm.kind === "lounge") lounge(rm);
      else if (rm.kind === "team") { teamTable(rm); if (rm.cooler) waterCooler(rm.cooler.x, rm.cooler.y); }
    });
    // potted plants in corners of the floor
    [{ x: 14, y: 12 }, { x: 54, y: 12 }, { x: 1, y: 22 }, { x: 54, y: 34 }, { x: 16, y: 34 }].forEach((p) => plant(p.x * TILE, p.y * TILE));
  }
  function confTable(rm) {
    const x = rm.tx * TILE + 16, y = rm.ty * TILE + rm.th * TILE / 2 - 8, w = rm.tw * TILE - 34, h = 16;
    rug(x - 8, y - 12, w + 16, h + 26, "#3a4a5a");
    r(x, y, w, h, "#7a4f2c"); r(x, y, w, 3, "#9c6b3f");
    for (let s = x + 8; s < x + w - 4; s += 16) { chair(s, y - 8); chair(s, y + h + 2); }
    r(x + w / 2 - 5, y + 4, 10, 8, "#3f9158"); // centerpiece plant
    // projector screen on top wall
    r(rm.tx * TILE + rm.tw * TILE / 2 - 14, rm.ty * TILE + 1, 28, 3, "#e8e8ee");
  }
  function teamTable(rm) {
    const x = rm.tx * TILE + 3, y = rm.ty * TILE + 14, w = Math.min(rm.tw * TILE - 10, 70), h = 11;
    r(x, y, w, h, "#7a4f2c"); r(x, y, w, 2, "#9c6b3f");
    for (let s = x + 8; s < x + w - 4; s += 16) { chair(s, y - 7); chair(s, y + h + 1); }
  }
  function cafeteria(rm) {
    const bx = rm.tx * TILE, by = rm.ty * TILE, bw = rm.tw * TILE, bh = rm.th * TILE;
    // counter along top
    r(bx + 6, by + 16, bw - 12, 12, "#b9bec6"); r(bx + 6, by + 16, bw - 12, 2, "#d6dade");
    r(bx + 14, by + 19, 7, 6, "#2b2f36"); r(bx + 16, by + 14, 2, 5, "#9aa"); // sink + faucet
    r(bx + 30, by + 18, 9, 7, "#3a3f49"); r(bx + 31, by + 19, 7, 3, "#8fd1ff"); // microwave
    // fridge
    r(bx + bw - 22, by + 14, 14, 24, "#dfe3e8"); r(bx + bw - 22, by + 26, 14, 1, "#9aa"); r(bx + bw - 11, by + 17, 1.5, 7, "#8a929c"); r(bx + bw - 11, by + 28, 1.5, 7, "#8a929c");
    // vending machine
    r(bx + 6, by + bh - 24, 12, 22, "#2b3a55"); r(bx + 8, by + bh - 22, 8, 12, "#7fb0ff"); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) r(bx + 9 + j * 4, by + bh - 20 + i * 4, 2, 2, pick(["#e7483b", "#f4c84a", "#49b36a"])); r(bx + 8, by + bh - 8, 8, 2, "#111");
    // coffee machine
    r(bx + 22, by + bh - 22, 9, 10, "#3a3f49"); r(bx + 24, by + bh - 14, 5, 3, "#1a1d22"); r(bx + 24, by + bh - 20, 5, 2, "#c0392b");
    // round table + stools
    const tx = bx + bw / 2 + 6, tyy = by + bh - 16; disc(tx, tyy, 9, "#8a5a34"); disc(tx, tyy, 9, "rgba(0,0,0,0)"); ctx.strokeStyle = "#6f4a28"; ctx.stroke();
    [[-13, 0], [13, 0], [0, -12], [0, 12]].forEach((o) => disc(tx + o[0], tyy + o[1], 4, "#444a56"));
    // shelving on right wall
    for (let i = 0; i < 3; i++) { r(bx + bw - 8, by + 6 + i * 6, 6, 4, "#6b4423"); r(bx + bw - 7, by + 6 + i * 6, 1.5, 4, "#c04"); r(bx + bw - 5, by + 6 + i * 6, 1.5, 4, "#2a2"); }
  }
  function lounge(rm) {
    const bx = rm.tx * TILE, by = rm.ty * TILE, bw = rm.tw * TILE, bh = rm.th * TILE;
    // couch
    r(bx + 8, by + 18, 40, 12, "#3e5165"); r(bx + 8, by + 16, 40, 4, "#4a6179"); r(bx + 6, by + 18, 4, 12, "#4a6179"); r(bx + 44, by + 18, 4, 12, "#4a6179");
    // coffee table + rug
    rug(bx + 14, by + 32, 30, 10, "#5a4a3a"); r(bx + 20, by + 34, 18, 6, "#7a4f2c");
    // bookshelves
    for (let b = 0; b < 2; b++) { const sx = bx + bw - 16 + b * 8, sy = by + 6; r(sx, sy, 7, 26, "#6b4423"); for (let i = 0; i < 4; i++) { r(sx + 1, sy + 2 + i * 6, 5, 5, "#8a5a34"); r(sx + 1, sy + 2 + i * 6, 1.5, 5, pick(["#c04", "#28c", "#2a2", "#f4c84a"])); r(sx + 4, sy + 2 + i * 6, 1.5, 5, pick(["#c04", "#28c", "#2a2", "#f4c84a"])); } }
    plant(bx + 4, by + bh - 20);
  }
  function rug(x, y, w, h, c) { ctx.fillStyle = c; roundRect(x, y, w, h, 3); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 1; roundRect(x + 2, y + 2, w - 4, h - 4, 2); ctx.stroke(); }
  function plant(x, y) { r(x + 4, y + 10, 8, 6, "#8a5a34"); disc(x + 8, y + 6, 7, "#3f8f58"); disc(x + 5, y + 4, 3.5, "#57b06e"); disc(x + 11, y + 5, 3, "#4f9f63"); }
  function waterCooler(x, y) { r(x, y - 10, 8, 12, "#dfe3e8"); r(x + 1, y - 14, 6, 6, "#7fc6ff"); r(x + 2, y + 2, 6, 3, "#8a929c"); }
  function chair(cx, cy) { r(cx - 4, cy - 3, 8, 7, "#3b3f49"); r(cx - 4, cy - 4, 8, 2, "#4a505c"); r(cx - 1, cy + 4, 2, 2, "#2a2d34"); }
  function officeChair(cx, cy) { disc(cx, cy, 5, "#2d313a"); disc(cx, cy, 3.5, "#3b414c"); r(cx - 4, cy - 6, 8, 3, "#444b57"); for (let a = 0; a < 5; a++) { const an = a / 5 * 6.283; r(cx + Math.cos(an) * 5 - 0.5, cy + Math.sin(an) * 5 - 0.5, 1.5, 1.5, "#23262c"); } }

  function drawDesk(p) {
    const x = p.deskX, y = p.deskY;
    officeChair(x + 14, y + 22);
    r(x, y + 10, 28, 3, "#5f4026"); r(x, y, 28, 11, "#9c6b3f"); r(x, y, 28, 2, "#b98a5a");
    // monitor + content
    r(x + 8, y - 9, 13, 9, "#11161d"); r(x + 9, y - 8, 11, 7, "#0e1620"); r(x + 13, y + 0, 3, 2, "#2a3340"); r(x + 10, y + 2, 9, 1, "#3a4350");
    const lit = colorOf(p.role);
    r(x + 10, y - 7, 9, 1, lit); r(x + 10, y - 5, 6, 1, "rgba(255,255,255,.45)"); r(x + 10, y - 3, 7, 1, "rgba(255,255,255,.25)");
    if (!p.walking && p.status === "working" && Math.floor(S.time * 2) % 2 === 0) r(x + 10, y - 1, 3, 1, "#9ff0e6");
    // keyboard + mouse
    r(x + 6, y + 6, 13, 3, "#cfd3da"); r(x + 21, y + 7, 3, 2, "#cfd3da");
  }
  function drawPerson(p) {
    const x = Math.round(p.x), y = Math.round(p.y + p.bob);
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(x, y, 6, 2.5, 0, 0, 7); ctx.fill();
    const sw = p.walking ? (Math.floor(S.time * 10) % 2 ? 1.5 : -1.5) : 0;
    r(x - 3 + sw, y - 6, 2.6, 6, "#2f3340"); r(x + 1 - sw, y - 6, 2.6, 6, "#2f3340");
    r(x - 3 + sw, y - 1, 2.6, 2, "#1b1d22"); r(x + 1 - sw, y - 1, 2.6, 2, "#1b1d22"); // shoes
    r(x - 4.2, y - 13, 8.4, 8, p.shirt); r(x - 4.2, y - 13, 8.4, 1.6, "rgba(255,255,255,.18)");
    r(x - 5.4, y - 12, 1.8, 6, p.shirt); r(x + 3.6, y - 12, 1.8, 6, p.shirt);
    r(x - 1.5, y - 13, 3, 3, hexA("#000000", 0.14)); // collar hint
    disc(x, y - 17, 4, p.skin); // head
    hair(x, y - 20, p.hair, p.hairStyle);
    if (p.facing !== "up") { r(x - 1.8, y - 17.5, 1.2, 1.3, "#222"); r(x + 0.7, y - 17.5, 1.2, 1.3, "#222"); }
    if (p === S.byId[S.selected]) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.9; roundRect(x - 6, y - 24, 12, 26, 3); ctx.stroke(); }
    // name plate (bold, outlined)
    ctx.font = "6px ui-sans-serif, sans-serif"; const nm = first(p.name), nw = ctx.measureText(nm).width;
    ctx.fillStyle = "rgba(10,12,14,.72)"; roundRect(x - nw / 2 - 2, y + 2, nw + 4, 8, 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(nm, x - nw / 2, y + 8);
  }
  function hair(x, y, c, style) {
    if (style === 3) { disc(x, y + 1, 3.6, c); r(x - 3.6, y + 1, 7.2, 2, c); return; } // short/bald-ish
    r(x - 4, y - 1, 8, 3.4, c); // cap
    if (style === 0) { r(x - 4, y - 1, 1.8, 5, c); r(x + 2.2, y - 1, 1.8, 5, c); }
    else if (style === 1) { r(x - 4, y - 1, 8, 1.6, c); r(x - 4, y - 1, 2.4, 4, c); }
    else if (style === 2) { disc(x, y - 3, 2.4, c); r(x - 4, y - 1, 8, 2, c); } // bun
    else if (style === 4) { r(x - 4, y - 1, 8, 2, c); r(x + 2.6, y + 1, 2, 6, c); } // ponytail
    else { r(x - 4.2, y - 1, 8.4, 3.2, c); r(x - 4.2, y - 1, 1.6, 5, c); r(x + 2.6, y - 1, 1.6, 5, c); }
  }
  function drawStatusPill(p) {
    const text = statusWord(p);
    ctx.font = "6px ui-sans-serif, sans-serif"; const w = ctx.measureText(text).width + 7, x = Math.round(p.x) - w / 2, yy = Math.round(p.y + p.bob) - 34;
    ctx.fillStyle = "#f6f4ec"; roundRect(x, yy, w, 9, 2); ctx.fill(); ctx.strokeStyle = "#c7c2b2"; ctx.lineWidth = 0.6; ctx.stroke();
    r(x + 3, yy + 3.5, 2, 2, p.status === "meeting" ? "#f6b24a" : p.walking ? "#64748b" : colorOf(p.role));
    ctx.fillStyle = "#1b1b1b"; ctx.fillText(text, x + 7, yy + 6.6);
  }
  function drawEnvelope(e) {
    const t = Math.min(1, e.t), x = e.sx + (e.tx - e.sx) * t, y = e.sy + (e.ty - e.sy) * t - Math.sin(t * Math.PI) * 16;
    r(x - 5, y - 3, 10, 7, "#fbfaf4"); ctx.strokeStyle = "#b9b3a2"; ctx.lineWidth = .5; ctx.strokeRect(x - 5, y - 3, 10, 7);
    ctx.beginPath(); ctx.moveTo(x - 5, y - 3); ctx.lineTo(x, y + 1); ctx.lineTo(x + 5, y - 3); ctx.strokeStyle = "#c9765a"; ctx.stroke();
  }

  function drawAmbient() {
    const h = S.simMin / 60; let oc = null, oa = 0;
    if (h < 10) { oc = "255,150,70"; oa = 0.14 * clamp(10 - h, 0, 1); }
    else if (h < 16) { oa = 0; }
    else if (h < 19) { oc = "255,138,54"; oa = 0.22 * clamp((h - 16) / 3, 0, 1); }
    else { oc = "16,24,60"; oa = 0.12 + 0.32 * clamp((h - 19) / 4, 0, 1); }
    if (oa > 0) { ctx.fillStyle = "rgba(" + oc + "," + oa.toFixed(3) + ")"; ctx.fillRect(0, 0, LOGW, LOGH); }
    if (S.glowBoost > 0.05) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      S.lights.forEach((l) => { const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.rad * 0.75); g.addColorStop(0, "rgba(255,232,186," + (0.16 * S.glowBoost).toFixed(3) + ")"); g.addColorStop(1, "rgba(255,232,186,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, l.rad * 0.75, 0, 7); ctx.fill(); });
      ctx.restore();
    }
  }
  function bustHair(cx, cy, c, style) {
    if (style === 3) { r(cx - 12, cy + 2, 3, 7, c); r(cx + 9, cy + 2, 3, 7, c); return; } // balding: side hair only
    r(cx - 12, cy - 11, 24, 8, c); // cap
    if (style === 0) { r(cx - 12, cy - 11, 5, 15, c); r(cx + 7, cy - 11, 5, 15, c); }
    else if (style === 1) { r(cx - 12, cy - 11, 24, 4, c); r(cx - 12, cy - 11, 7, 13, c); }
    else if (style === 2) { disc(cx, cy - 14, 6, c); }
    else if (style === 4) { r(cx + 7, cy - 6, 5, 17, c); }
    else { r(cx - 12, cy - 11, 5, 15, c); r(cx + 7, cy - 11, 5, 15, c); }
  }
  function drawPortrait(p) {
    const w = 66, h = 76, x = clamp(Math.round(p.x) - w / 2, 2, LOGW - w - 2), y = clamp(Math.round(p.y) - h - 26, 2, LOGH - h - 2), col = TEAM_COLORS[p.team] || "#4b5563";
    ctx.fillStyle = "rgba(0,0,0,.4)"; roundRect(x + 2, y + 3, w, h, 5); ctx.fill();
    ctx.fillStyle = "#12151b"; roundRect(x, y, w, h, 5); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    const cx = x + w / 2, hy = y + 22;
    ctx.fillStyle = p.shirt; roundRect(cx - 16, y + 34, 32, 24, 8); ctx.fill();
    disc(cx, hy, 12, p.skin);
    bustHair(cx, hy, p.hair, p.hairStyle);
    r(cx - 4, hy - 1, 2.4, 2.8, "#222"); r(cx + 1.6, hy - 1, 2.4, 2.8, "#222");
    r(cx - 2.5, hy + 5, 5, 1.4, "rgba(0,0,0,.3)");
    ctx.textAlign = "center";
    ctx.font = "7px ui-sans-serif, sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText(first(p.name), cx, y + h - 20);
    ctx.font = "5px ui-monospace, monospace"; ctx.fillStyle = col; ctx.fillText((ROLES[p.role] || {}).label || "", cx, y + h - 12);
    ctx.fillStyle = "#9aa3b2"; ctx.fillText(p.ticket + " · " + statusWord(p), cx, y + h - 5);
    ctx.textAlign = "left";
  }
  function render() {
    const hh = S.simMin / 60; S.glowBoost = clamp((hh - 16) / 5, 0, 1);
    r(0, 0, LOGW, LOGH, "#0b0d10");
    drawFloor(); drawLights(); drawWalls(); drawWallDecor(); drawRoomsFurniture();
    S.people.forEach(drawDesk);
    S.envelopes.forEach(drawEnvelope);
    const order = S.people.slice().sort((a, b) => a.y - b.y);
    order.forEach((p) => { if (visible(p)) drawPerson(p); });
    drawAmbient();
    order.forEach((p) => { if (visible(p)) drawStatusPill(p); });
    if (S.hover) drawPortrait(S.hover);
  }
  function visible(p) { return (S.filter === "all" || p.team === S.filter) && (S.chapterFilter === "all" || p.chapter === S.chapterFilter); }

  // ---------- sim ----------
  // BFS pathfinding across walkable tiles so agents walk THROUGH doorways, not walls.
  function pathTiles(sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return [];
    const key = (x, y) => y * GRID_W + x, prev = new Map(), q = [[sx, sy]];
    prev.set(key(sx, sy), null);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let found = false;
    while (q.length) {
      const cur = q.shift();
      if (cur[0] === tx && cur[1] === ty) { found = true; break; }
      for (const d of dirs) {
        const nx = cur[0] + d[0], ny = cur[1] + d[1];
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H || isWall(nx, ny)) continue;
        const k = key(nx, ny); if (prev.has(k)) continue; prev.set(k, cur); q.push([nx, ny]);
      }
    }
    if (!found) return null;
    const path = []; let c = [tx, ty];
    while (c) { path.push(c); c = prev.get(key(c[0], c[1])); }
    path.reverse(); return path.slice(1);
  }
  function goTo(p, destPx, pending, label) {
    const sx = clamp(Math.floor(p.x / TILE), 0, GRID_W - 1), sy = clamp(Math.floor(p.y / TILE), 0, GRID_H - 1);
    const tx = clamp(Math.floor(destPx.x / TILE), 0, GRID_W - 1), ty = clamp(Math.floor(destPx.y / TILE), 0, GRID_H - 1);
    const tiles = pathTiles(sx, sy, tx, ty) || [];
    const pts = tiles.map((t) => ({ x: t[0] * TILE + 8, y: t[1] * TILE + 11 }));
    pts.push({ x: destPx.x, y: destPx.y });
    p.path = pts; p.pendingStatus = pending || "working"; if (label) p.destLabel = label;
  }
  function moveTick(dt) {
    S.people.forEach((p) => {
      if (p.path && p.path.length) {
        const wp = p.path[0], dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy);
        if (d < 1.3) { p.x = wp.x; p.y = wp.y; p.path.shift(); if (p.path.length === 0) { p.walking = false; p.status = p.pendingStatus || "working"; p.destLabel = "desk"; if (p.status === "starting") p.startTimer = rand(1.5, 3); } }
        else { const sp = Math.min(p.speed * dt, d); p.x += dx / d * sp; p.y += dy / d * sp; p.walking = true; p.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"); }
      }
      if (p.startTimer > 0) { p.startTimer -= dt; if (p.startTimer <= 0 && p.status === "starting") p.status = "working"; }
      if (p.status === "working" && !p.walking) { p.actTimer -= dt; if (p.actTimer <= 0) { p.activity = fillAct(pick(ACTIVITIES[p.role] || ["working"])); p.actTimer = rand(4, 8); } }
      p.bob = (!p.walking && (p.status === "working" || p.status === "idle")) ? Math.sin(S.time * 3 + p.phase) * 0.6 : 0;
    });
    S.envelopes = S.envelopes.filter((e) => { e.t += dt / e.dur; return e.t < 1; });
  }
  function advance(dm) {
    S.people.forEach((p) => {
      if (p.busy || p.status === "break" || p.status === "starting") return;
      p.progress += p.rate * dm;
      if (p.progress >= 100) { feed('<span class="who" style="color:' + colorOf(p.role) + '">' + first(p.name) + "</span> shipped " + p.ticket + ": " + p.task, "ship"); S.shippedToday++; assignTask(p); }
    });
  }
  const sayLine = (p, other) => fillTask(pick(SAY[p.role] || SAY.leadership)).replace("{other}", first(other));
  function startTalk(a, b) {
    if (a.busy || b.busy || a.walking || b.walking || a.status === "messaging" || b.status === "messaging") return;
    const line = sayLine(a, b.name), cross = a.team !== b.team;
    a.status = "messaging"; b.status = "awaiting";
    S.envelopes.push({ sx: a.x, sy: a.y - 16, tx: b.x, ty: b.y - 16, t: 0, dur: 1.1 });
    feed('<span class="who" style="color:' + colorOf(a.role) + '">' + first(a.name) + "</span> → <span class=\"who\" style=\"color:" + colorOf(b.role) + "\">" + first(b.name) + "</span>" + (cross ? ' <span class="ts">[cross-team]</span>' : "") + ": " + line);
    S.talks.push({ a: a, b: b, end: S.simMin + rand(4, 8) });
  }
  function updateTalks() { S.talks = S.talks.filter((t) => { if (S.simMin >= t.end) {[t.a, t.b].forEach((p) => { if (!p.busy && !p.walking) p.status = "working"; }); return false; } return true; }); }
  function maybeConversation(dm) {
    if (S.talks.length >= 5 || Math.random() > dm * 0.035) return;
    const free = S.people.filter((p) => !p.busy && !p.walking && p.status === "working");
    if (free.length < 2) return;
    const a = pick(free); let pool = free.filter((p) => p.id !== a.id);
    if (Math.random() < 0.5) { const s = pool.filter((p) => p.team === a.team); if (s.length) pool = s; } else { const d = pool.filter((p) => p.team !== a.team); if (d.length) pool = d; }
    startTalk(a, pick(pool));
  }
  function seatsInRoom(rm, n) {
    const x0 = (rm.tx + 1) * TILE, y0 = (rm.ty + 2) * TILE, x1 = (rm.tx + rm.tw - 1) * TILE, y1 = (rm.ty + rm.th - 1) * TILE;
    const cols = Math.max(1, Math.round(Math.sqrt(n * (x1 - x0) / Math.max(1, y1 - y0)))), rows = Math.ceil(n / cols), out = [];
    for (let i = 0; i < n; i++) { const c = i % cols, rr = Math.floor(i / cols); out.push({ x: x0 + (x1 - x0) * (cols === 1 ? 0.5 : c / (cols - 1)), y: y0 + (y1 - y0) * (rows === 1 ? 0.5 : rr / (rows - 1)) }); }
    return out;
  }
  function gather(people, rm) { const seats = seatsInRoom(rm, people.length), lbl = rm.label.split(" ")[0]; people.forEach((p, i) => { p.busy = true; goTo(p, { x: seats[i].x, y: seats[i].y }, "meeting", lbl); }); }
  function disperse(people) { people.forEach((p) => { p.busy = false; goTo(p, { x: p.hx, y: p.hy }, "working", "desk"); }); }
  function startMeeting(kind, teamId) {
    let people, label, dur, decision = null, room;
    if (kind === "standup") { room = roomById(teamId); people = S.people.filter((p) => p.team === teamId && !p.busy); label = TEAMS[teamId].name + " stand-up"; dur = 18; }
    else if (kind === "design") { room = roomById("allhands"); const d = S.people.filter((p) => (p.role === "designer" || p.role === "head_design") && !p.busy); const x = S.people.filter((p) => (p.role === "pm" || p.role === "developer") && !p.busy).slice(0, 2); people = d.concat(x); label = "Design review"; dur = 36; }
    else if (kind === "arch") { room = roomById("allhands"); people = S.people.filter((p) => (p.role === "architect" || p.role === "principal_architect") && !p.busy); label = "Architecture sync"; dur = 34; }
    else if (kind === "council") { room = roomById("leadership"); people = S.people.filter((p) => p.team === "leadership" && !p.busy); decision = pick(DECISIONS); label = "Decision council"; dur = 50; }
    else if (kind === "lunch") { room = roomById("cafeteria"); people = shuffle(S.people.filter((p) => !p.busy)).slice(0, randint(4, 7)); label = "Lunch"; dur = 42; }
    else if (kind === "chapter") { room = roomById("allhands"); people = S.people.filter((p) => p.chapter === teamId && !p.busy); label = (CHAPTERS[teamId] || {}).label + " chapter sync"; dur = 28; }
    if (!room || !people || people.length < 2) return;
    gather(people, room);
    let lines = [];
    if (kind === "council") { feed("Council convened — " + decision.q, "event"); const sp = shuffle(people.slice()); lines = COUNCIL_LINES.slice(0, Math.min(5, sp.length)).map((t, i) => ({ by: sp[i], text: t })); }
    else { feed(label + " in " + room.label.toLowerCase() + " (" + people.length + ")", "event"); lines = shuffle(people.slice()).slice(0, 3).map((p) => ({ by: p, text: sayLine(p, pick(people).name) })); }
    if (kind === "lunch") people.forEach((p) => { p.pendingStatus = "break"; });
    S.meetings.push({ kind: kind, label: label, room: room, people: people, decision: decision, lines: lines, nextLine: S.simMin + 4, gap: Math.max(3, dur / (lines.length + 1)), end: S.simMin + dur });
  }
  function updateMeetings() {
    S.meetings = S.meetings.filter((m) => {
      if (m.lines.length && S.simMin >= m.nextLine) { const ln = m.lines.shift(); feed('<span class="who" style="color:' + colorOf(ln.by.role) + '">' + first(ln.by.name) + "</span> (" + m.label + "): " + ln.text); m.nextLine = S.simMin + m.gap; }
      if (S.simMin >= m.end) {
        if (m.kind === "council" && m.decision) {
          const outcome = pick(m.decision.options), consensus = randint(4, m.people.length), conf = randint(74, 96);
          feed("Decision: " + outcome + " — consensus " + consensus + "/" + m.people.length + ", confidence " + conf + "% — awaiting human approval", "decision");
          S.approvals++; setTimeout(() => { if (S.approvals > 0) { S.approvals--; feed("Human approved: " + outcome, "event"); } }, randint(6000, 12000));
        }
        disperse(m.people); return false;
      }
      return true;
    });
  }
  function schedule() {
    if (S.simMin >= S.nextStandup) { const t = ["atlas", "nova", "orion"]; startMeeting("standup", t[S.standupIdx++ % 3]); S.nextStandup += 70; }
    if (S.simMin >= S.nextReview) { startMeeting(Math.random() < 0.5 ? "design" : "arch"); S.nextReview += 150; }
    if (S.simMin >= S.nextDecision) { startMeeting("council"); S.nextDecision += 260; }
    if (S.simMin >= S.nextChapter) { const ch = ["product", "design", "architecture", "engineering", "quality", "platform"]; startMeeting("chapter", ch[S.chapterIdx++ % ch.length]); S.nextChapter += 120; }
    if (!S.lunchDone && S.simMin >= 12 * 60 + 30) { startMeeting("lunch"); S.lunchDone = true; }
  }

  // ---------- DOM ----------
  const clockStr = (min) => { min = ((Math.floor(min) % 1440) + 1440) % 1440; const h = Math.floor(min / 60), m = Math.floor(min % 60); return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m; };
  let lastMin = -1;
  function domTick() {
    if (Math.floor(S.simMin) !== lastMin) { lastMin = Math.floor(S.simMin); $("clock").textContent = clockStr(S.simMin); }
    let working = 0, review = 0, testing = 0, meeting = 0;
    S.people.forEach((p) => { if (p.status === "meeting") meeting++; else if (p.status === "break") {} else if (p.role === "reviewer") review++; else if (p.role === "qa" || p.role === "qa_lead") testing++; else working++; });
    $("board").innerHTML = stat(working, "on task") + stat(review, "review") + stat(testing, "testing") + stat(meeting, "meeting", "warn") + stat(S.shippedToday, "shipped", "ok");
    const ap = $("approvals"); ap.textContent = "approvals · " + S.approvals; ap.classList.toggle("zero", S.approvals === 0);
    if (S.selectedKind === "person" && S.byId[S.selected]) renderPersonInspector(S.byId[S.selected]);
  }
  const stat = (n, l, c) => '<div class="stat ' + (c || "") + '"><b>' + n + "</b><span>" + l + "</span></div>";
  function feed(text, kind) { const ul = $("feed"), li = document.createElement("li"); li.innerHTML = '<span class="ts">' + clockStr(S.simMin) + "</span><span class=\"" + (kind ? "kind-" + kind : "") + "\">" + text + "</span>"; ul.insertBefore(li, ul.firstChild); while (ul.children.length > 70) ul.removeChild(ul.lastChild); }
  const seniority = (y) => y >= 16 ? "Director" : y >= 12 ? "Principal" : y >= 8 ? "Staff" : y >= 5 ? "Senior" : "Mid";
  function renderInspector() { if (S.selectedKind === "person" && S.byId[S.selected]) return renderPersonInspector(S.byId[S.selected]); if (S.selectedKind === "room") return renderRoomInspector(S.selected); if (S.selectedKind === "team") return renderTeamInspector(S.selected); renderRoster(); }
  function renderPersonInspector(p) {
    $("inspector").innerHTML =
      '<div class="insp-name"><span class="insp-av" style="background:' + colorOf(p.role) + '">' + initials(p.name) + "</span>" + p.name + "</div>" +
      '<div class="insp-role">' + (ROLES[p.role] || {}).label + " · " + TEAMS[p.team].name + " · " + (CHAPTERS[p.chapter] || {}).label + " chapter</div>" +
      '<div class="insp-row"><span class="tag">' + p.years + " yrs</span><span class=\"tag\">" + seniority(p.years) + "</span><span class=\"tag\" style=\"border-color:" + (CHAPTERS[p.chapter] || {}).color + "\">" + (p.id === (CHAPTERS[p.chapter] || {}).lead ? "chapter lead" : "lead · " + first((S.byId[(CHAPTERS[p.chapter] || {}).lead] || { name: "—" }).name)) + "</span><span class=\"tag\">" + statusWord(p) + "</span></div>" +
      '<div class="insp-task"><div class="lbl">' + p.ticket + " · assigned work</div><div class=\"val\">" + p.task + "</div>" +
      '<div class="insp-bar"><i style="width:' + Math.min(100, p.progress).toFixed(0) + '%"></i></div><div class="insp-role" style="margin-top:6px">' + Math.min(100, p.progress).toFixed(0) + "% complete</div></div>" +
      '<div class="insp-bio">' + p.bio + "</div>";
  }
  function renderRoomInspector(id) {
    const rm = roomById(id), here = S.people.filter((p) => p.x >= rm.tx * TILE && p.x <= (rm.tx + rm.tw) * TILE && p.y >= rm.ty * TILE && p.y <= (rm.ty + rm.th) * TILE);
    const purpose = rm.kind === "cafeteria" ? "Breaks, coffee & casual cross-team talk." : rm.kind === "lounge" ? "Reading nook & downtime." : rm.team ? TEAMS[rm.team].name + "'s room — desks + its own stand-up table." : "Shared all-hands — cross-team design & architecture.";
    $("inspector").innerHTML = '<div class="insp-name">' + rm.label + "</div><div class=\"insp-role\">" + purpose + "</div><div class=\"insp-row\"><span class=\"tag\">" + here.length + " here now</span></div><div style=\"margin-top:10px\">" + (here.length ? here.map(rosterRow).join("") : '<div class="insp-role">Empty right now.</div>') + "</div>";
    wireRows();
  }
  function renderTeamInspector(team) {
    const members = S.people.filter((p) => p.team === team);
    $("inspector").innerHTML = '<div class="insp-name"><span class="insp-av" style="background:' + TEAM_COLORS[team] + '">' + TEAMS[team].name.slice(0, 2).toUpperCase() + "</span>" + TEAMS[team].name + "</div><div class=\"insp-role\">" + members.length + " people · walled section with its own stand-up table</div><div style=\"margin-top:10px\">" + members.map(rosterRow).join("") + "</div>";
    wireRows();
  }
  function renderRoster() {
    const order = ["leadership", "atlas", "nova", "orion", "platform"];
    $("inspector").innerHTML = '<div class="insp-name" style="font-size:13px">Everyone &amp; their work</div><div class="insp-role" style="margin-bottom:8px">' + S.people.length + " people · click a desk, a person, or a room" + "</div>" +
      order.map((tid) => '<div class="roster-team"><div class="rt-name" style="color:' + TEAM_COLORS[tid] + '">' + TEAMS[tid].name + "</div>" + S.people.filter((p) => p.team === tid).map(rosterRow).join("") + "</div>").join("");
    wireRows();
  }
  const rosterRow = (p) => '<div class="roster-row" data-id="' + p.id + '"><span class="roster-av" style="background:' + colorOf(p.role) + '">' + initials(p.name) + '</span><span class="rr-name">' + first(p.name) + '</span><span class="rr-meta"><span class="statusdot ' + statusKindClass(p) + '"></span>' + statusWord(p) + "</span></div>";
  function wireRows() { Array.prototype.forEach.call(document.querySelectorAll(".roster-row"), (row) => row.addEventListener("click", () => selectPerson(row.getAttribute("data-id")))); }

  // ---------- interactions ----------
  const inRoom = (x, y, rm) => x >= rm.tx * TILE && x <= (rm.tx + rm.tw) * TILE && y >= rm.ty * TILE && y <= (rm.ty + rm.th) * TILE;
  function toLogical(e) { const b = canvas.getBoundingClientRect(); return { x: (e.clientX - b.left) / (b.width / LOGW), y: (e.clientY - b.top) / (b.height / LOGH) }; }
  function personAt(lx, ly) { let best = null, bd = 13; S.people.forEach((p) => { const d = Math.hypot(p.x - lx, p.y - ly - 10); if (d < bd) { bd = d; best = p; } }); return best; }
  function onClick(e) {
    const { x, y } = toLogical(e), p = personAt(x, y);
    if (p) return selectPerson(p.id);
    const rm = ROOMS_DEF.find((rr) => inRoom(x, y, rr));
    if (rm) { if (rm.team) { S.selected = rm.team; S.selectedKind = "team"; } else { S.selected = rm.id; S.selectedKind = "room"; } return renderInspector(); }
    S.selected = null; S.selectedKind = null; renderInspector();
  }
  function onHover(e) { const { x, y } = toLogical(e); S.hover = personAt(x, y); canvas.style.cursor = S.hover ? "pointer" : "default"; }
  function selectPerson(id) { S.selected = id; S.selectedKind = "person"; renderInspector(); }
  function wireControls() {
    $("autoMode").addEventListener("click", function () { S.auto = !S.auto; this.classList.toggle("on", S.auto); this.classList.toggle("off", !S.auto); this.textContent = S.auto ? "auto mode on" : "auto mode off"; });
    $("speed").addEventListener("change", function () { S.speed = parseFloat(this.value); });
    $("teamFilter").addEventListener("change", function () { S.filter = this.value; });
    $("chapterFilter").addEventListener("change", function () { S.chapterFilter = this.value; });
    $("btnStandup").addEventListener("click", () => { const t = ["atlas", "nova", "orion"]; startMeeting("standup", t[S.standupIdx++ % 3]); });
    $("btnCouncil").addEventListener("click", () => startMeeting("council"));
    window.addEventListener("resize", fit);
  }

  // ---------- loop ----------
  let last = 0;
  function loop(t) {
    if (!last) last = t; const dt = Math.min(0.05, (t - last) / 1000); last = t; S.time += dt;
    if (S.auto) {
      const dm = dt * S.speed * MIN_PER_SEC; S.simMin += dm;
      if (S.simMin >= 23 * 60) { S.simMin = 9 * 60; S.day++; S.shippedToday = 0; S.lunchDone = false; S.nextStandup = 9 * 60 + 25; S.nextReview = 9 * 60 + 80; S.nextDecision = 9 * 60 + 140; S.nextChapter = 9 * 60 + 55; feed("— Day " + S.day + " begins —", "event"); }
      advance(dm); maybeConversation(dm); schedule(); updateMeetings(); updateTalks();
    }
    moveTick(dt); render(); domTick(); requestAnimationFrame(loop);
  }

  build(); wireControls();
  feed("Office opened — Sprint 1, Day 1. Walled floor online: 5 team rooms, all-hands, cafeteria & lounge.", "event");
  requestAnimationFrame(loop);
})();
