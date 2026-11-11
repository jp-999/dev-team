/* Pixel-art office — procedural canvas renderer + assignment simulation.
 * Vanilla JS, no deps, runs from file://. Depends on globals in data.js.
 * Art is drawn procedurally (no external tilesets). Vibe inspired by munder-difflin. */
(function () {
  "use strict";

  // ---------- constants ----------
  const TILE = 16, GRID_W = 44, GRID_H = 30, LOGW = GRID_W * TILE, LOGH = GRID_H * TILE;
  const S_INTERNAL = 3;
  const MIN_PER_SEC = 3;

  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const randint = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const first = (n) => n.split(" ")[0];
  const initials = (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colorOf = (role) => TRACK_COLORS[(ROLES[role] || {}).track] || "#8891a5";
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = randint(0, i);[a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Special rooms (tile rects). Desks live outside these.
  const ROOMS_T = [
    { id: "conference", label: "CONFERENCE · EVEREST", kind: "meeting", tx: 1, ty: 1, tw: 13, th: 7 },
    { id: "fuji", label: "CONF · FUJI", kind: "meeting", tx: 35, ty: 1, tw: 8, th: 7 },
    { id: "warroom", label: "WAR ROOM · COUNCIL", kind: "meeting", tx: 35, ty: 9, tw: 8, th: 7 },
    { id: "kitchen", label: "CAFETERIA · THE HUB", kind: "break", tx: 35, ty: 17, tw: 8, th: 12 },
    { id: "lobby", label: "LOBBY", kind: "common", tx: 16, ty: 1, tw: 18, th: 2 },
  ];
  const roomById = (id) => ROOMS_T.find((r) => r.id === id);
  const MEETING_ROOM = { standup: "conference", design: "conference", arch: "fuji", council: "warroom", lunch: "kitchen" };

  const DESK_REGIONS = [
    { tx: 16, ty: 4, tw: 17, th: 4 },   // upper strip beside the lobby
    { tx: 1, ty: 9, tw: 31, th: 20 },   // main desk farm
  ];

  const PROPS = [
    { t: "plant", tx: 2, ty: 27 }, { t: "plant", tx: 32, ty: 9 }, { t: "plant", tx: 2, ty: 9 },
    { t: "plant", tx: 31, ty: 27 }, { t: "plant", tx: 14, ty: 9 }, { t: "plant", tx: 24, ty: 9 },
    { t: "bookshelf", tx: 10, ty: 9 }, { t: "whiteboard", tx: 19, ty: 1 },
  ];

  // ---------- canvas ----------
  const canvas = $("floor");
  const ctx = canvas.getContext("2d");
  function fit() {
    const stage = $("stage");
    canvas.width = LOGW * S_INTERNAL; canvas.height = LOGH * S_INTERNAL;
    ctx.setTransform(S_INTERNAL, 0, 0, S_INTERNAL, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const sw = stage.clientWidth || LOGW, sh = stage.clientHeight || LOGH;
    const scale = Math.min(sw / LOGW, sh / LOGH);
    canvas.style.width = Math.max(1, Math.floor(LOGW * scale)) + "px";
    canvas.style.height = Math.max(1, Math.floor(LOGH * scale)) + "px";
  }

  // ---------- state ----------
  const S = {
    people: [], byId: {}, auto: true, speed: 2, simMin: 9 * 60, day: 1,
    shippedToday: 0, filter: "all", selected: null, selectedKind: null, hover: null,
    meetings: [], talks: [], envelopes: [], time: 0,
    nextStandup: 9 * 60 + 25, nextReview: 9 * 60 + 80, nextDecision: 9 * 60 + 140,
    lunchDone: false, standupIdx: 0,
  };

  // ---------- content helpers ----------
  const fillTask = (t) => t.replace("{f}", pick(FEATURES)).replace("{n}", randint(120, 940));
  function assignTask(p) {
    const pool = TASKS_BY_ROLE[p.role] || ["Working on {f}"];
    p.task = fillTask(pick(pool));
    p.progress = rand(2, 22);
    p.rate = (0.5 + p.years / 24) * rand(0.8, 1.3);
    p.status = "starting"; p.startTimer = rand(2, 4.5);
  }
  function roleVerb(role) {
    if (role === "reviewer") return "reviewing";
    if (role === "qa" || role === "qa_lead") return "testing";
    if (role === "designer" || role === "head_design") return "designing";
    if (role === "architect" || role === "principal_architect") return "architecting";
    if (role === "pm" || role === "head_product" || role === "director") return "planning";
    if (role === "integrator" || role === "devops_lead") return "shipping";
    return "coding";
  }
  function statusWord(p) {
    if (p.walking) return STATUS_WORDS.walking;
    if (p.status === "working") return roleVerb(p.role);
    return STATUS_WORDS[p.status] || "working";
  }
  function statusKindClass(p) {
    if (p.status === "meeting") return "s-meeting";
    if (p.status === "break") return "s-break";
    if (p.role === "reviewer") return "s-review";
    if (p.role === "qa" || p.role === "qa_lead") return "s-testing";
    return "s-working";
  }

  // ---------- build world ----------
  function genSlots() {
    const slots = [];
    DESK_REGIONS.forEach((rg) => {
      for (let ty = rg.ty; ty + 1 < rg.ty + rg.th; ty += 5)
        for (let tx = rg.tx; tx + 1 < rg.tx + rg.tw; tx += 4) slots.push({ tx: tx, ty: ty });
    });
    return slots;
  }
  function build() {
    const slots = genSlots();
    PEOPLE.forEach((person, i) => {
      const slot = slots[i % slots.length];
      const hx = slot.tx * TILE + 15, hy = slot.ty * TILE + 30;
      const p = Object.assign({}, person, {
        slot: slot, deskX: slot.tx * TILE + 2, deskY: slot.ty * TILE + 7,
        x: hx, y: hy, hx: hx, hy: hy, target: null, pendingStatus: "working",
        walking: false, facing: "up", busy: false, bob: 0, phase: rand(0, 6.28),
        skin: SKIN_TONES[i % SKIN_TONES.length], hair: HAIR_COLORS[i % HAIR_COLORS.length],
        shirt: colorOf(person.role), speed: rand(40, 60),
      });
      assignTask(p);
      S.people.push(p); S.byId[p.id] = p;
    });

    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onHover);
    canvas.addEventListener("mouseleave", () => { S.hover = null; });
    fit();
    renderInspector();
  }

  // ---------- drawing primitives ----------
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  function roundRect(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
  }

  function drawFloor() {
    for (let ty = 0; ty < GRID_H; ty++) for (let tx = 0; tx < GRID_W; tx++) {
      const border = tx === 0 || ty === 0 || tx === GRID_W - 1 || ty === GRID_H - 1;
      if (border) { r(tx * TILE, ty * TILE, TILE, TILE, "#2b271d"); continue; }
      r(tx * TILE, ty * TILE, TILE, TILE, (tx + ty) % 2 === 0 ? "#6f8f74" : "#74927a");
      ctx.fillStyle = "rgba(0,0,0,.05)";
      ctx.fillRect(tx * TILE, ty * TILE, TILE, 1); ctx.fillRect(tx * TILE, ty * TILE, 1, TILE);
    }
    // top wall strip with windows
    r(TILE, TILE, LOGW - 2 * TILE, 6, "#d7cdb6");
    for (let wx = TILE + 10; wx < LOGW - TILE - 14; wx += 46) { r(wx, 2, 26, 7, "#8fb7d6"); r(wx, 2, 26, 2, "#b9d6ea"); }
  }
  function drawRooms() {
    ROOMS_T.forEach((rm) => {
      const x = rm.tx * TILE, y = rm.ty * TILE, w = rm.tw * TILE, h = rm.th * TILE;
      ctx.fillStyle = rm.kind === "meeting" ? "rgba(74,120,150,.34)" : rm.kind === "break" ? "rgba(150,128,74,.34)" : "rgba(120,140,120,.18)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(18,22,18,.55)"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      roomLabel(x + 4, y + 2, rm.label);
    });
  }
  function roomLabel(x, y, text) {
    ctx.font = "5px ui-monospace, monospace";
    const w = ctx.measureText(text).width + 6;
    ctx.fillStyle = "rgba(10,14,12,.55)"; roundRect(x, y, w, 8, 2); ctx.fill();
    ctx.fillStyle = "#e7e3d6"; ctx.fillText(text, x + 3, y + 6);
  }

  function drawDesk(p) {
    const x = p.deskX, y = p.deskY;
    r(x, y + 10, 28, 3, "#5f4026");          // front edge / shadow
    r(x, y, 28, 11, "#9c6b3f");              // wood top
    r(x, y, 28, 2, "#b98a5a");               // highlight
    // monitor
    r(x + 9, y - 8, 11, 8, "#1b2530"); r(x + 10, y - 7, 9, 6, "#13202b");
    r(x + 10, y - 7, 9, 1, "#50d2c5");       // screen glow line
    if (!p.walking && p.status === "working" && Math.floor(S.time * 2) % 2 === 0) r(x + 12, y - 5, 4, 1, "#9ff0e6");
    r(x + 13, y, 3, 2, "#2a3340");           // stand
    // keyboard
    r(x + 7, y + 6, 14, 3, "#cfd3da");
  }
  function drawChairTopDown(cx, cy, color) { r(cx - 5, cy - 4, 10, 9, color || "#3b3f49"); r(cx - 5, cy - 4, 10, 2, "#4a505c"); }

  function drawPerson(p) {
    const x = Math.round(p.x), y = Math.round(p.y + p.bob);
    ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(x, y, 6, 2.4, 0, 0, 7); ctx.fill();
    const legSwing = p.walking ? (Math.floor(S.time * 10) % 2 ? 1 : -1) : 0;
    r(x - 3 + legSwing, y - 6, 2.4, 6, "#2f3340");
    r(x + 1 - legSwing, y - 6, 2.4, 6, "#2f3340");
    r(x - 4, y - 13, 8, 8, p.shirt);                 // torso
    r(x - 5.2, y - 12, 1.6, 6, p.shirt); r(x + 3.6, y - 12, 1.6, 6, p.shirt); // arms
    r(x - 3.4, y - 20, 6.8, 7, p.skin);              // head
    r(x - 4, y - 21, 8, 3.2, p.hair);                // hair cap
    r(x - 4, y - 21, 1.6, 5, p.hair); r(x + 2.4, y - 21, 1.6, 5, p.hair);
    if (p.facing === "up") { /* back of head */ }
    else { r(x - 2, y - 16.5, 1.1, 1.1, "#222"); r(x + 0.9, y - 16.5, 1.1, 1.1, "#222"); }
    if (p === S.byId[S.selected]) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.8; ctx.strokeRect(x - 5, y - 22, 10, 23); }
  }

  function drawStatusPill(p) {
    const text = statusWord(p);
    ctx.font = "6px ui-sans-serif, sans-serif";
    const tw = ctx.measureText(text).width, w = tw + 6, h = 9, x = Math.round(p.x) - w / 2, y = Math.round(p.y + p.bob) - 34;
    ctx.fillStyle = "#f5f3ea"; roundRect(x, y, w, h, 2); ctx.fill();
    ctx.strokeStyle = "#c7c2b2"; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.fillStyle = "#1b1b1b"; ctx.fillText(text, x + 3, y + 6.5);
  }

  function drawProp(pr) {
    const x = pr.tx * TILE, y = pr.ty * TILE;
    if (pr.t === "plant") { r(x + 4, y + 9, 8, 6, "#8a5a34"); ctx.fillStyle = "#3f9158"; ctx.beginPath(); ctx.ellipse(x + 8, y + 6, 7, 7, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#57b06e"; ctx.beginPath(); ctx.ellipse(x + 6, y + 4, 3, 3, 0, 0, 7); ctx.fill(); }
    else if (pr.t === "bookshelf") { r(x, y, 14, 22, "#6b4423"); for (let i = 0; i < 3; i++) { r(x + 1, y + 2 + i * 7, 12, 5, "#8a5a34"); r(x + 2, y + 2 + i * 7, 2, 5, "#c04"); r(x + 5, y + 2 + i * 7, 2, 5, "#28c"); r(x + 8, y + 2 + i * 7, 2, 5, "#2a2"); } }
    else if (pr.t === "whiteboard") { r(x, y, 34, 12, "#eef1f4"); ctx.strokeStyle = "#8a8f98"; ctx.strokeRect(x + .5, y + .5, 33, 11); r(x + 3, y + 3, 16, 1.5, "#4a8"); r(x + 3, y + 6, 22, 1.5, "#48c"); r(x + 3, y + 9, 10, 1.5, "#c58"); }
  }
  function drawConferenceTable(rm) {
    const x = rm.tx * TILE + 24, y = rm.ty * TILE + 26, w = rm.tw * TILE - 48, h = 26;
    r(x, y, w, h, "#7a4f2c"); r(x, y, w, 3, "#9c6b3f");
    for (let cx = x + 8; cx < x + w - 4; cx += 18) { drawChairTopDown(cx, y - 7, "#444a56"); drawChairTopDown(cx, y + h + 7, "#444a56"); }
    r(x + w / 2 - 4, y + 7, 8, 8, "#3f9158"); // plant on table
  }
  function drawRoomTable(rm, chairs) {
    const x = rm.tx * TILE + 16, y = rm.ty * TILE + 34, w = rm.tw * TILE - 32, h = 20;
    r(x, y, w, h, "#7a4f2c"); r(x, y, w, 3, "#9c6b3f");
    for (let i = 0, cx = x + 6; i < chairs && cx < x + w; i++, cx += 16) { drawChairTopDown(cx, y - 6, "#444a56"); drawChairTopDown(cx, y + h + 6, "#444a56"); }
  }
  function drawKitchen(rm) {
    const bx = rm.tx * TILE, by = rm.ty * TILE;
    r(bx + 4, by + 10, 12, 18, "#d7dbe0"); r(bx + 4, by + 10, 12, 18, "#cfd4da"); r(bx + 13, by + 14, 1.5, 6, "#8a929c"); // fridge
    r(bx + 20, by + 12, rm.tw * TILE - 26, 10, "#b9beC6"); r(bx + 20, by + 12, rm.tw * TILE - 26, 2, "#d6dade"); // counter
    r(bx + 24, by + 14, 6, 5, "#2b2f36"); // sink
    r(bx + rm.tw * TILE - 16, by + rm.th * TILE - 18, 10, 14, "#cfd4da"); r(bx + rm.tw * TILE - 14, by + rm.th * TILE - 16, 6, 5, "#49b3ff"); // water cooler
    r(bx + 6, by + rm.th * TILE - 16, 12, 12, "#3a3f49"); r(bx + 8, by + rm.th * TILE - 13, 8, 3, "#cdd2d8"); // printer
  }

  function drawEnvelope(e) {
    const t = Math.min(1, e.t);
    const x = e.sx + (e.tx - e.sx) * t, y = e.sy + (e.ty - e.sy) * t - Math.sin(t * Math.PI) * 14;
    r(x - 5, y - 3, 10, 7, "#fbfaf4"); ctx.strokeStyle = "#b9b3a2"; ctx.lineWidth = .5; ctx.strokeRect(x - 5, y - 3, 10, 7);
    ctx.beginPath(); ctx.moveTo(x - 5, y - 3); ctx.lineTo(x, y + 1); ctx.lineTo(x + 5, y - 3); ctx.strokeStyle = "#c9765a"; ctx.stroke();
  }

  // ---------- render ----------
  function render() {
    ctx.clearRect(0, 0, LOGW, LOGH);
    drawFloor();
    drawRooms();
    PROPS.forEach(drawProp);
    drawConferenceTable(roomById("conference"));
    drawRoomTable(roomById("fuji"), 3);
    drawRoomTable(roomById("warroom"), 3);
    drawKitchen(roomById("kitchen"));
    S.people.forEach(drawDesk);
    S.envelopes.forEach(drawEnvelope);

    const order = S.people.slice().sort((a, b) => a.y - b.y);
    order.forEach((p) => { if (!(S.filter !== "all" && p.team !== S.filter)) drawPerson(p); });
    order.forEach((p) => {
      if (S.filter !== "all" && p.team !== S.filter) return;
      const notable = p.status !== "working" || p.walking || p === S.byId[S.selected] || p === S.hover;
      if (notable) drawStatusPill(p);
    });
    if (S.hover) { ctx.font = "6px ui-sans-serif"; const t = first(S.hover.name) + " · " + (ROLES[S.hover.role] || {}).label; roomLabel(Math.round(S.hover.x) - 20, Math.round(S.hover.y) - 46, t); }
  }

  // ---------- simulation ----------
  function moveTick(dt) {
    S.people.forEach((p) => {
      if (p.target) {
        const dx = p.target.x - p.x, dy = p.target.y - p.y, d = Math.hypot(dx, dy);
        if (d < 1.3) { p.x = p.target.x; p.y = p.target.y; p.target = null; p.walking = false; p.status = p.pendingStatus || "working"; if (p.status === "starting") p.startTimer = rand(1.5, 3); }
        else { const sp = Math.min(p.speed * dt, d); p.x += dx / d * sp; p.y += dy / d * sp; p.walking = true; p.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"); }
      }
      if (p.startTimer > 0) { p.startTimer -= dt; if (p.startTimer <= 0 && p.status === "starting") p.status = "working"; }
      p.bob = (!p.walking && (p.status === "working" || p.status === "idle")) ? Math.sin(S.time * 3 + p.phase) * 0.6 : 0;
    });
    S.envelopes = S.envelopes.filter((e) => { e.t += dt / e.dur; return e.t < 1; });
  }

  function advance(dm) {
    S.people.forEach((p) => {
      if (p.busy || p.status === "break" || p.status === "starting") return;
      p.progress += p.rate * dm;
      if (p.progress >= 100) {
        feed('<span class="who" style="color:' + colorOf(p.role) + '">' + first(p.name) + "</span> finished: " + p.task, "ship");
        S.shippedToday++; assignTask(p);
      }
    });
  }

  function sayLine(p, otherName) {
    const pool = SAY[p.role] || SAY.leadership;
    return fillTask(pick(pool)).replace("{other}", first(otherName));
  }
  function startTalk(a, b) {
    if (a.busy || b.busy || a.walking || b.walking || a.status === "messaging" || b.status === "messaging") return;
    const line = sayLine(a, b.name), cross = a.team !== b.team;
    a.status = "messaging"; b.status = "awaiting";
    S.envelopes.push({ sx: a.x, sy: a.y - 16, tx: b.x, ty: b.y - 16, t: 0, dur: 1.1 });
    feed('<span class="who" style="color:' + colorOf(a.role) + '">' + first(a.name) + "</span> → " +
      '<span class="who" style="color:' + colorOf(b.role) + '">' + first(b.name) + "</span>" +
      (cross ? ' <span class="ts">[cross-team]</span>' : "") + ": " + line);
    S.talks.push({ a: a, b: b, end: S.simMin + rand(4, 8) });
  }
  function updateTalks() {
    S.talks = S.talks.filter((t) => {
      if (S.simMin >= t.end) {[t.a, t.b].forEach((p) => { if (!p.busy && !p.walking) p.status = "working"; }); return false; }
      return true;
    });
  }
  function maybeConversation(dm) {
    if (S.talks.length >= 4 || Math.random() > dm * 0.03) return;
    const free = S.people.filter((p) => !p.busy && !p.walking && (p.status === "working"));
    if (free.length < 2) return;
    const a = pick(free);
    let pool = free.filter((p) => p.id !== a.id);
    if (Math.random() < 0.5) { const s = pool.filter((p) => p.team === a.team); if (s.length) pool = s; }
    else { const d = pool.filter((p) => p.team !== a.team); if (d.length) pool = d; }
    startTalk(a, pick(pool));
  }

  function seatsInRoom(room, n) {
    const x0 = (room.tx + 1) * TILE, y0 = (room.ty + 2) * TILE, x1 = (room.tx + room.tw - 1) * TILE, y1 = (room.ty + room.th - 1) * TILE;
    const cols = Math.max(1, Math.round(Math.sqrt(n * (x1 - x0) / Math.max(1, y1 - y0))));
    const rows = Math.ceil(n / cols), seats = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols, rr = Math.floor(i / cols);
      seats.push({ x: x0 + (x1 - x0) * (cols === 1 ? 0.5 : c / (cols - 1)), y: y0 + (y1 - y0) * (rows === 1 ? 0.5 : rr / (rows - 1)) });
    }
    return seats;
  }
  function gather(people, room) { const seats = seatsInRoom(room, people.length); people.forEach((p, i) => { p.busy = true; p.pendingStatus = "meeting"; p.target = { x: seats[i].x, y: seats[i].y }; }); }
  function disperse(people) { people.forEach((p) => { p.busy = false; p.pendingStatus = "working"; p.target = { x: p.hx, y: p.hy }; }); }

  function startMeeting(kind, teamId) {
    const room = roomById(MEETING_ROOM[kind]);
    let people, label, dur, decision = null;
    if (kind === "standup") { people = S.people.filter((p) => p.team === teamId && !p.busy); label = TEAMS[teamId].name + " stand-up"; dur = 18; }
    else if (kind === "design") { const d = S.people.filter((p) => (p.role === "designer" || p.role === "head_design") && !p.busy); const x = S.people.filter((p) => (p.role === "pm" || p.role === "developer") && !p.busy).slice(0, 2); people = d.concat(x); label = "Design review"; dur = 36; }
    else if (kind === "arch") { people = S.people.filter((p) => (p.role === "architect" || p.role === "principal_architect") && !p.busy); label = "Architecture sync"; dur = 34; }
    else if (kind === "council") { people = S.people.filter((p) => p.team === "leadership" && !p.busy); decision = pick(DECISIONS); label = "Decision council"; dur = 52; }
    else if (kind === "lunch") { people = shuffle(S.people.filter((p) => !p.busy)).slice(0, randint(4, 7)); label = "Lunch"; dur = 44; }
    if (!people || people.length < 2) return;

    gather(people, room);
    let lines = [];
    if (kind === "council") { feed("Council convened — " + decision.q, "event"); const sp = shuffle(people.slice()); lines = COUNCIL_LINES.slice(0, Math.min(5, sp.length)).map((t, i) => ({ by: sp[i], text: t })); }
    else { feed(label + " in " + room.label.toLowerCase() + " (" + people.length + ")", "event"); lines = shuffle(people.slice()).slice(0, 3).map((p) => ({ by: p, text: sayLine(p, pick(people).name) })); }
    if (kind === "lunch") people.forEach((p) => { p.pendingStatus = "break"; });
    S.meetings.push({ kind: kind, label: label, room: room, people: people, decision: decision, lines: lines, nextLine: S.simMin + 4, gap: Math.max(3, dur / (lines.length + 1)), end: S.simMin + dur });
  }
  function updateMeetings() {
    S.meetings = S.meetings.filter((m) => {
      if (m.lines.length && S.simMin >= m.nextLine) {
        const ln = m.lines.shift();
        feed('<span class="who" style="color:' + colorOf(ln.by.role) + '">' + first(ln.by.name) + "</span> (" + m.label + "): " + ln.text);
        m.nextLine = S.simMin + m.gap;
      }
      if (S.simMin >= m.end) {
        if (m.kind === "council" && m.decision) {
          const outcome = pick(m.decision.options), consensus = randint(4, m.people.length), conf = randint(74, 96);
          feed("Decision: " + outcome + " — consensus " + consensus + "/" + m.people.length + ", confidence " + conf + "%", "decision");
        }
        disperse(m.people); return false;
      }
      return true;
    });
  }
  function schedule() {
    if (S.simMin >= S.nextStandup) { const t = ["atlas", "nova", "orion"]; startMeeting("standup", t[S.standupIdx++ % 3]); S.nextStandup += 95; }
    if (S.simMin >= S.nextReview) { startMeeting(Math.random() < 0.5 ? "design" : "arch"); S.nextReview += 150; }
    if (S.simMin >= S.nextDecision) { startMeeting("council"); S.nextDecision += 260; }
    if (!S.lunchDone && S.simMin >= 12 * 60 + 30) { startMeeting("lunch"); S.lunchDone = true; }
  }

  // ---------- DOM: board / feed / inspector ----------
  function clockStr(min) { min = ((Math.floor(min) % 1440) + 1440) % 1440; const h = Math.floor(min / 60), m = Math.floor(min % 60); return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m; }
  let lastMin = -1;
  function domTick() {
    if (Math.floor(S.simMin) !== lastMin) { lastMin = Math.floor(S.simMin); $("clock").textContent = clockStr(S.simMin); }
    let working = 0, review = 0, testing = 0, meeting = 0;
    S.people.forEach((p) => {
      if (p.status === "meeting") meeting++;
      else if (p.status === "break") { }
      else if (p.role === "reviewer") review++;
      else if (p.role === "qa" || p.role === "qa_lead") testing++;
      else working++;
    });
    $("board").innerHTML = stat(working, "on task") + stat(review, "review") + stat(testing, "testing") + stat(meeting, "meeting", "warn") + stat(S.shippedToday, "shipped", "ok");
    if (S.selectedKind === "person" && S.byId[S.selected]) renderPersonInspector(S.byId[S.selected]);
  }
  const stat = (n, l, c) => '<div class="stat ' + (c || "") + '"><b>' + n + "</b><span>" + l + "</span></div>";

  function feed(text, kind) {
    const ul = $("feed"), li = document.createElement("li");
    li.innerHTML = '<span class="ts">' + clockStr(S.simMin) + "</span><span class=\"" + (kind ? "kind-" + kind : "") + "\">" + text + "</span>";
    ul.insertBefore(li, ul.firstChild);
    while (ul.children.length > 70) ul.removeChild(ul.lastChild);
  }

  function seniority(y) { return y >= 16 ? "Director" : y >= 12 ? "Principal" : y >= 8 ? "Staff" : y >= 5 ? "Senior" : "Mid"; }
  function renderInspector() {
    if (S.selectedKind === "person" && S.byId[S.selected]) return renderPersonInspector(S.byId[S.selected]);
    if (S.selectedKind === "room") return renderRoomInspector(S.selected);
    renderRoster();
  }
  function renderPersonInspector(p) {
    $("inspector").innerHTML =
      '<div class="insp-name"><span class="insp-av" style="background:' + colorOf(p.role) + '">' + initials(p.name) + "</span>" + p.name + "</div>" +
      '<div class="insp-role">' + (ROLES[p.role] || {}).label + " · " + TEAMS[p.team].name + "</div>" +
      '<div class="insp-row"><span class="tag">' + p.years + " yrs</span><span class=\"tag\">" + seniority(p.years) + "</span><span class=\"tag\">" + statusWord(p) + "</span></div>" +
      '<div class="insp-task"><div class="lbl">Assigned work</div><div class="val">' + p.task + "</div>" +
      '<div class="insp-bar"><i style="width:' + Math.min(100, p.progress).toFixed(0) + '%"></i></div>' +
      '<div class="insp-role" style="margin-top:6px">' + Math.min(100, p.progress).toFixed(0) + "% complete</div></div>" +
      '<div class="insp-bio">' + p.bio + "</div>";
  }
  function renderRoomInspector(id) {
    const rm = roomById(id);
    const here = S.people.filter((p) => p.x >= rm.tx * TILE && p.x <= (rm.tx + rm.tw) * TILE && p.y >= rm.ty * TILE && p.y <= (rm.ty + rm.th) * TILE);
    const purpose = { conference: "Design & cross-team reviews, stand-ups.", fuji: "Architecture syncs.", warroom: "The decision council meets here.", kitchen: "Breaks and casual cross-team talk.", lobby: "Reception." }[id] || "";
    $("inspector").innerHTML = '<div class="insp-name">' + rm.label + "</div><div class=\"insp-role\">" + purpose + "</div>" +
      '<div class="insp-row"><span class="tag">' + here.length + " here now</span></div><div style=\"margin-top:10px\">" +
      (here.length ? here.map((p) => rosterRow(p)).join("") : '<div class="insp-role">Empty right now.</div>') + "</div>";
    wireRows();
  }
  function renderRoster() {
    const order = ["leadership", "atlas", "nova", "orion", "platform"];
    $("inspector").innerHTML = '<div class="insp-name" style="font-size:13px">Everyone &amp; their work</div><div class="insp-role" style="margin-bottom:8px">' + S.people.length + " people · click anyone on the floor</div>" +
      order.map((tid) => '<div class="roster-team"><div class="rt-name">' + TEAMS[tid].name + "</div>" + S.people.filter((p) => p.team === tid).map((p) => rosterRow(p)).join("") + "</div>").join("");
    wireRows();
  }
  const rosterRow = (p) => '<div class="roster-row" data-id="' + p.id + '"><span class="roster-av" style="background:' + colorOf(p.role) + '">' + initials(p.name) + '</span><span class="rr-name">' + first(p.name) + '</span><span class="rr-meta"><span class="statusdot ' + statusKindClass(p) + '"></span>' + statusWord(p) + "</span></div>";
  function wireRows() { Array.prototype.forEach.call(document.querySelectorAll(".roster-row"), (row) => row.addEventListener("click", () => selectPerson(row.getAttribute("data-id")))); }

  // ---------- interactions ----------
  function toLogical(e) { const b = canvas.getBoundingClientRect(); return { x: (e.clientX - b.left) / (b.width / LOGW), y: (e.clientY - b.top) / (b.height / LOGH) }; }
  function personAt(lx, ly) { let best = null, bd = 13; S.people.forEach((p) => { const d = Math.hypot(p.x - lx, p.y - ly - 10); if (d < bd) { bd = d; best = p; } }); return best; }
  function onClick(e) {
    const { x, y } = toLogical(e), p = personAt(x, y);
    if (p) return selectPerson(p.id);
    const rm = ROOMS_T.find((r) => x >= r.tx * TILE && x <= (r.tx + r.tw) * TILE && y >= r.ty * TILE && y <= (r.ty + r.th) * TILE);
    if (rm) { S.selected = rm.id; S.selectedKind = "room"; renderInspector(); } else { S.selected = null; S.selectedKind = null; renderInspector(); }
  }
  function onHover(e) { const { x, y } = toLogical(e); S.hover = personAt(x, y); canvas.style.cursor = S.hover ? "pointer" : "default"; }
  function selectPerson(id) { S.selected = id; S.selectedKind = "person"; renderInspector(); }

  function wireControls() {
    $("autoMode").addEventListener("click", function () { S.auto = !S.auto; this.classList.toggle("on", S.auto); this.classList.toggle("off", !S.auto); this.textContent = S.auto ? "auto mode on" : "auto mode off"; });
    $("speed").addEventListener("change", function () { S.speed = parseFloat(this.value); });
    $("teamFilter").addEventListener("change", function () { S.filter = this.value; });
    $("btnStandup").addEventListener("click", () => { const t = ["atlas", "nova", "orion"]; startMeeting("standup", t[S.standupIdx++ % 3]); });
    $("btnCouncil").addEventListener("click", () => startMeeting("council"));
    window.addEventListener("resize", fit);
  }

  // ---------- loop ----------
  let last = 0;
  function loop(t) {
    if (!last) last = t;
    const dt = Math.min(0.05, (t - last) / 1000); last = t; S.time += dt;
    if (S.auto) {
      const dm = dt * S.speed * MIN_PER_SEC; S.simMin += dm;
      if (S.simMin >= 18 * 60) { S.simMin = 9 * 60; S.day++; S.shippedToday = 0; S.lunchDone = false; S.nextStandup = 9 * 60 + 25; S.nextReview = 9 * 60 + 80; S.nextDecision = 9 * 60 + 140; feed("— Day " + S.day + " begins —", "event"); }
      advance(dm); maybeConversation(dm); schedule(); updateMeetings(); updateTalks();
    }
    moveTick(dt);
    render();
    domTick();
    requestAnimationFrame(loop);
  }

  // ---------- go ----------
  build();
  wireControls();
  feed("Office opened — Sprint 1, Day 1. Everyone is on their assigned work.", "event");
  requestAnimationFrame(loop);
})();
