/* Pixel-art office — procedural canvas renderer + assignment simulation.
 * Sectioned by team (each team is a colored, labeled zone with its OWN conference room),
 * plus a shared All-Hands and cafeteria. Vanilla JS, no deps, runs from file://.
 * Best-of ideas borrowed: per-team rooms, desk-to-desk mailbox envelopes (Munder hive),
 * ticket keys (Munder/Keystroke), human-approval gate on council decisions (Relevance). */
(function () {
  "use strict";

  const TILE = 16, GRID_W = 50, GRID_H = 32, LOGW = GRID_W * TILE, LOGH = GRID_H * TILE;
  const S_INTERNAL = 3, MIN_PER_SEC = 3;

  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const randint = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const first = (n) => n.split(" ")[0];
  const initials = (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colorOf = (role) => TRACK_COLORS[(ROLES[role] || {}).track] || "#8891a5";
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = randint(0, i);[a[i], a[j]] = [a[j], a[i]]; } return a; };

  // team identity colors (zone borders/labels); avatar shirts stay role-colored
  const TEAM_COLORS = { leadership: "#64748b", atlas: "#3b82f6", nova: "#a855f7", orion: "#ef7a3b", platform: "#10b981" };

  // Each team = a bordered zone with its own conference sub-room.
  const ZONES = [
    { team: "leadership", label: "LEADERSHIP", tx: 1, ty: 1, tw: 15, th: 15, conf: { id: "conf_leadership", label: "COUNCIL · WAR ROOM", tx: 2, ty: 11, tw: 13, th: 4 } },
    { team: "atlas", label: "TEAM ATLAS", tx: 17, ty: 1, tw: 16, th: 15, conf: { id: "conf_atlas", label: "ATLAS CONF", tx: 18, ty: 11, tw: 14, th: 4 } },
    { team: "nova", label: "TEAM NOVA", tx: 34, ty: 1, tw: 15, th: 15, conf: { id: "conf_nova", label: "NOVA CONF", tx: 35, ty: 11, tw: 13, th: 4 } },
    { team: "orion", label: "TEAM ORION", tx: 1, ty: 17, tw: 15, th: 14, conf: { id: "conf_orion", label: "ORION CONF", tx: 2, ty: 27, tw: 13, th: 3 } },
    { team: "platform", label: "PLATFORM", tx: 17, ty: 17, tw: 16, th: 14, conf: { id: "conf_platform", label: "PLATFORM BAY", tx: 18, ty: 27, tw: 14, th: 3 } },
  ];
  const SHARED = [
    { id: "allhands", label: "ALL-HANDS", kind: "meeting", tx: 34, ty: 17, tw: 15, th: 6 },
    { id: "cafeteria", label: "CAFETERIA · THE HUB", kind: "break", tx: 34, ty: 24, tw: 15, th: 7 },
  ];
  const zoneOf = (team) => ZONES.find((z) => z.team === team);
  const ROOMS = {}; // key -> {id,label,rect{tx,ty,tw,th},kind,team}
  ZONES.forEach((z) => { ROOMS[z.conf.id] = { id: z.conf.id, label: z.conf.label, rect: z.conf, kind: "meeting", team: z.team }; });
  SHARED.forEach((s) => { ROOMS[s.id] = { id: s.id, label: s.label, rect: { tx: s.tx, ty: s.ty, tw: s.tw, th: s.th }, kind: s.kind }; });
  const MEETING_ROOM = { design: "allhands", arch: "allhands", council: "conf_leadership", lunch: "cafeteria" };

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
    people: [], byId: {}, auto: true, speed: 2, simMin: 9 * 60, day: 1, shippedToday: 0,
    filter: "all", selected: null, selectedKind: null, hover: null, time: 0,
    meetings: [], talks: [], envelopes: [], ticketSeq: 100, approvals: 0,
    nextStandup: 9 * 60 + 25, nextReview: 9 * 60 + 80, nextDecision: 9 * 60 + 140, lunchDone: false, standupIdx: 0,
  };

  // ---------- content ----------
  const fillTask = (t) => t.replace("{f}", pick(FEATURES)).replace("{n}", randint(120, 940));
  function assignTask(p) {
    const pool = TASKS_BY_ROLE[p.role] || ["Working on {f}"];
    p.task = fillTask(pick(pool)); p.progress = rand(2, 22);
    p.rate = (0.5 + p.years / 24) * rand(0.8, 1.3); p.status = "starting"; p.startTimer = rand(2, 4.5);
    p.ticket = "DT-" + (++S.ticketSeq);
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
  const statusWord = (p) => p.walking ? STATUS_WORDS.walking : p.status === "working" ? roleVerb(p.role) : (STATUS_WORDS[p.status] || "working");
  function statusKindClass(p) {
    if (p.status === "meeting") return "s-meeting"; if (p.status === "break") return "s-break";
    if (p.role === "reviewer") return "s-review"; if (p.role === "qa" || p.role === "qa_lead") return "s-testing";
    return "s-working";
  }

  // ---------- build ----------
  function placeDesks(area, n) {
    const cols = Math.min(n, Math.max(2, Math.round(area.w / 3.5))), rows = Math.ceil(n / cols);
    const stepX = area.w / cols, stepY = area.h / rows, out = [];
    for (let i = 0; i < n; i++) { const c = i % cols, rr = Math.floor(i / cols); out.push({ tx: Math.round(area.x + stepX * (c + 0.5) - 1), ty: Math.round(area.y + stepY * rr) }); }
    return out;
  }
  function build() {
    ZONES.forEach((z) => {
      const members = PEOPLE.filter((p) => p.team === z.team);
      const area = { x: z.tx + 1, y: z.ty + 2, w: z.tw - 2, h: z.conf.ty - (z.ty + 2) - 1 };
      const slots = placeDesks(area, members.length);
      members.forEach((person, i) => {
        const s = slots[i] || slots[slots.length - 1];
        const hx = s.tx * TILE + 15, hy = s.ty * TILE + 30, idx = PEOPLE.indexOf(person);
        const p = Object.assign({}, person, {
          deskX: s.tx * TILE + 2, deskY: s.ty * TILE + 7, x: hx, y: hy, hx: hx, hy: hy,
          target: null, pendingStatus: "working", walking: false, facing: "up", busy: false, bob: 0, phase: rand(0, 6.28),
          skin: SKIN_TONES[idx % SKIN_TONES.length], hair: HAIR_COLORS[idx % HAIR_COLORS.length], shirt: colorOf(person.role), speed: rand(40, 60),
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
    $("legend").innerHTML = ZONES.map((z) => '<span class="li"><span class="sw" style="background:' + TEAM_COLORS[z.team] + '"></span>' + TEAMS[z.team].name + "</span>").join("");
  }

  // ---------- draw primitives ----------
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  function roundRect(x, y, w, h, rad) { ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath(); }
  function pill(x, y, text, bg, fg, size) { ctx.font = (size || 5) + "px ui-monospace, monospace"; const w = ctx.measureText(text).width + 6; ctx.fillStyle = bg; roundRect(x, y, w, (size || 5) + 4, 2); ctx.fill(); ctx.fillStyle = fg; ctx.fillText(text, x + 3, y + (size || 5) + 1.5); return w; }

  function drawFloor() {
    for (let ty = 0; ty < GRID_H; ty++) for (let tx = 0; tx < GRID_W; tx++) {
      if (tx === 0 || ty === 0 || tx === GRID_W - 1 || ty === GRID_H - 1) { r(tx * TILE, ty * TILE, TILE, TILE, "#2b271d"); continue; }
      r(tx * TILE, ty * TILE, TILE, TILE, (tx + ty) % 2 === 0 ? "#6f8f74" : "#74927a");
      ctx.fillStyle = "rgba(0,0,0,.05)"; ctx.fillRect(tx * TILE, ty * TILE, TILE, 1); ctx.fillRect(tx * TILE, ty * TILE, 1, TILE);
    }
    r(TILE, TILE, LOGW - 2 * TILE, 6, "#d7cdb6");
    for (let wx = TILE + 10; wx < LOGW - TILE - 14; wx += 46) { r(wx, 2, 26, 7, "#8fb7d6"); r(wx, 2, 26, 2, "#b9d6ea"); }
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; }

  function drawZones() {
    ZONES.forEach((z) => {
      const x = z.tx * TILE, y = z.ty * TILE, w = z.tw * TILE, h = z.th * TILE, col = TEAM_COLORS[z.team];
      ctx.fillStyle = hexA(col, 0.07); ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = col; roundRect(x + 3, y + 3, Math.min(w - 6, z.label.length * 4.2 + 8), 9, 2); ctx.fill();
      ctx.font = "6px ui-monospace, monospace"; ctx.fillStyle = "#fff"; ctx.fillText(z.label, x + 6, y + 10);
      // conference sub-room
      const c = z.conf, cx = c.tx * TILE, cy = c.ty * TILE, cw = c.tw * TILE, chh = c.th * TILE;
      ctx.fillStyle = hexA(col, 0.2); ctx.fillRect(cx, cy, cw, chh);
      ctx.strokeStyle = hexA(col, 0.8); ctx.lineWidth = 1; ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, chh - 1);
      roomTable(c); pill(cx + 3, cy + 2, c.label, "rgba(10,14,12,.6)", "#eee7d6", 5);
    });
    SHARED.forEach((s) => {
      const x = s.tx * TILE, y = s.ty * TILE, w = s.tw * TILE, h = s.th * TILE;
      ctx.fillStyle = s.kind === "break" ? "rgba(150,128,74,.3)" : "rgba(74,120,150,.3)"; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(18,22,18,.6)"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      if (s.kind === "break") drawKitchen(s); else roomTable({ tx: s.tx, ty: s.ty, tw: s.tw, th: s.th });
      pill(x + 3, y + 2, s.label, "rgba(10,14,12,.6)", "#eee7d6", 5);
    });
    // scatter a few plants along the top
    [{ tx: 16, ty: 2 }, { tx: 33, ty: 2 }, { tx: 48, ty: 17 }].forEach(drawPlant);
  }
  function roomTable(rc) {
    const x = rc.tx * TILE + 10, y = rc.ty * TILE + rc.th * TILE / 2 - 5, w = rc.tw * TILE - 20, h = 9;
    if (w < 10) return;
    r(x, y, w, h, "#7a4f2c"); r(x, y, w, 2, "#9c6b3f");
    for (let seat = x + 6; seat < x + w - 2; seat += 14) { r(seat - 3, y - 6, 7, 4, "#444a56"); r(seat - 3, y + h + 2, 7, 4, "#444a56"); }
  }
  function drawPlant(pr) { const x = pr.tx * TILE, y = pr.ty * TILE; r(x + 4, y + 9, 8, 6, "#8a5a34"); ctx.fillStyle = "#3f9158"; ctx.beginPath(); ctx.ellipse(x + 8, y + 6, 7, 7, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#57b06e"; ctx.beginPath(); ctx.ellipse(x + 6, y + 4, 3, 3, 0, 0, 7); ctx.fill(); }
  function drawKitchen(rm) {
    const bx = rm.tx * TILE, by = rm.ty * TILE;
    r(bx + 5, by + 12, 12, 18, "#d7dbe0"); r(bx + 14, by + 16, 1.5, 6, "#8a929c");
    r(bx + 22, by + 14, rm.tw * TILE - 30, 10, "#b9beC6"); r(bx + 22, by + 14, rm.tw * TILE - 30, 2, "#d6dade"); r(bx + 26, by + 16, 6, 5, "#2b2f36");
    r(bx + rm.tw * TILE - 16, by + rm.th * TILE - 20, 10, 14, "#cfd4da"); r(bx + rm.tw * TILE - 14, by + rm.th * TILE - 18, 6, 5, "#49b3ff");
  }
  function drawDesk(p) {
    const x = p.deskX, y = p.deskY;
    r(x, y + 10, 28, 3, "#5f4026"); r(x, y, 28, 11, "#9c6b3f"); r(x, y, 28, 2, "#b98a5a");
    r(x + 9, y - 8, 11, 8, "#1b2530"); r(x + 10, y - 7, 9, 6, "#13202b"); r(x + 10, y - 7, 9, 1, "#50d2c5");
    if (!p.walking && p.status === "working" && Math.floor(S.time * 2) % 2 === 0) r(x + 12, y - 5, 4, 1, "#9ff0e6");
    r(x + 13, y, 3, 2, "#2a3340"); r(x + 7, y + 6, 14, 3, "#cfd3da");
  }
  function drawPerson(p) {
    const x = Math.round(p.x), y = Math.round(p.y + p.bob);
    ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(x, y, 6, 2.4, 0, 0, 7); ctx.fill();
    const sw = p.walking ? (Math.floor(S.time * 10) % 2 ? 1 : -1) : 0;
    r(x - 3 + sw, y - 6, 2.4, 6, "#2f3340"); r(x + 1 - sw, y - 6, 2.4, 6, "#2f3340");
    r(x - 4, y - 13, 8, 8, p.shirt); r(x - 5.2, y - 12, 1.6, 6, p.shirt); r(x + 3.6, y - 12, 1.6, 6, p.shirt);
    r(x - 3.4, y - 20, 6.8, 7, p.skin); r(x - 4, y - 21, 8, 3.2, p.hair); r(x - 4, y - 21, 1.6, 5, p.hair); r(x + 2.4, y - 21, 1.6, 5, p.hair);
    if (p.facing !== "up") { r(x - 2, y - 16.5, 1.1, 1.1, "#222"); r(x + 0.9, y - 16.5, 1.1, 1.1, "#222"); }
    if (p === S.byId[S.selected]) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.8; ctx.strokeRect(x - 5, y - 22, 10, 23); }
  }
  function drawStatusPill(p) {
    const text = statusWord(p);
    ctx.font = "6px ui-sans-serif, sans-serif"; const w = ctx.measureText(text).width + 6, x = Math.round(p.x) - w / 2, y = Math.round(p.y + p.bob) - 34;
    ctx.fillStyle = "#f5f3ea"; roundRect(x, y, w, 9, 2); ctx.fill(); ctx.strokeStyle = "#c7c2b2"; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.fillStyle = "#1b1b1b"; ctx.fillText(text, x + 3, y + 6.5);
  }
  function drawEnvelope(e) {
    const t = Math.min(1, e.t), x = e.sx + (e.tx - e.sx) * t, y = e.sy + (e.ty - e.sy) * t - Math.sin(t * Math.PI) * 14;
    r(x - 5, y - 3, 10, 7, "#fbfaf4"); ctx.strokeStyle = "#b9b3a2"; ctx.lineWidth = .5; ctx.strokeRect(x - 5, y - 3, 10, 7);
    ctx.beginPath(); ctx.moveTo(x - 5, y - 3); ctx.lineTo(x, y + 1); ctx.lineTo(x + 5, y - 3); ctx.strokeStyle = "#c9765a"; ctx.stroke();
  }

  function render() {
    ctx.clearRect(0, 0, LOGW, LOGH);
    drawFloor(); drawZones();
    S.people.forEach(drawDesk);
    S.envelopes.forEach(drawEnvelope);
    const order = S.people.slice().sort((a, b) => a.y - b.y);
    order.forEach((p) => { if (!(S.filter !== "all" && p.team !== S.filter)) drawPerson(p); });
    order.forEach((p) => { if (S.filter !== "all" && p.team !== S.filter) return; if (p.status !== "working" || p.walking || p === S.byId[S.selected] || p === S.hover) drawStatusPill(p); });
    if (S.hover) pill(Math.round(S.hover.x) - 22, Math.round(S.hover.y) - 46, first(S.hover.name) + " · " + S.hover.ticket, "rgba(10,14,12,.78)", "#eee", 5);
  }

  // ---------- movement + sim ----------
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
      if (p.progress >= 100) { feed('<span class="who" style="color:' + colorOf(p.role) + '">' + first(p.name) + "</span> shipped " + p.ticket + ": " + p.task, "ship"); S.shippedToday++; assignTask(p); }
    });
  }
  function sayLine(p, other) { return fillTask(pick(SAY[p.role] || SAY.leadership)).replace("{other}", first(other)); }
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
    if (S.talks.length >= 4 || Math.random() > dm * 0.03) return;
    const free = S.people.filter((p) => !p.busy && !p.walking && p.status === "working");
    if (free.length < 2) return;
    const a = pick(free); let pool = free.filter((p) => p.id !== a.id);
    if (Math.random() < 0.5) { const s = pool.filter((p) => p.team === a.team); if (s.length) pool = s; } else { const d = pool.filter((p) => p.team !== a.team); if (d.length) pool = d; }
    startTalk(a, pick(pool));
  }
  function seatsInRoom(rect, n) {
    const x0 = (rect.tx + 1) * TILE, y0 = (rect.ty + 1.5) * TILE, x1 = (rect.tx + rect.tw - 1) * TILE, y1 = (rect.ty + rect.th - 0.5) * TILE;
    const cols = Math.max(1, Math.round(Math.sqrt(n * (x1 - x0) / Math.max(1, y1 - y0)))), rows = Math.ceil(n / cols), out = [];
    for (let i = 0; i < n; i++) { const c = i % cols, rr = Math.floor(i / cols); out.push({ x: x0 + (x1 - x0) * (cols === 1 ? 0.5 : c / (cols - 1)), y: y0 + (y1 - y0) * (rows === 1 ? 0.5 : rr / (rows - 1)) }); }
    return out;
  }
  function gather(people, rect) { const seats = seatsInRoom(rect, people.length); people.forEach((p, i) => { p.busy = true; p.pendingStatus = "meeting"; p.target = { x: seats[i].x, y: seats[i].y }; }); }
  function disperse(people) { people.forEach((p) => { p.busy = false; p.pendingStatus = "working"; p.target = { x: p.hx, y: p.hy }; }); }
  function startMeeting(kind, teamId) {
    let people, label, dur, decision = null, roomKey;
    if (kind === "standup") { roomKey = "conf_" + teamId; people = S.people.filter((p) => p.team === teamId && !p.busy); label = TEAMS[teamId].name + " stand-up"; dur = 18; }
    else if (kind === "design") { roomKey = "allhands"; const d = S.people.filter((p) => (p.role === "designer" || p.role === "head_design") && !p.busy); const x = S.people.filter((p) => (p.role === "pm" || p.role === "developer") && !p.busy).slice(0, 2); people = d.concat(x); label = "Design review"; dur = 36; }
    else if (kind === "arch") { roomKey = "allhands"; people = S.people.filter((p) => (p.role === "architect" || p.role === "principal_architect") && !p.busy); label = "Architecture sync"; dur = 34; }
    else if (kind === "council") { roomKey = "conf_leadership"; people = S.people.filter((p) => p.team === "leadership" && !p.busy); decision = pick(DECISIONS); label = "Decision council"; dur = 50; }
    else if (kind === "lunch") { roomKey = "cafeteria"; people = shuffle(S.people.filter((p) => !p.busy)).slice(0, randint(4, 7)); label = "Lunch"; dur = 42; }
    const room = ROOMS[roomKey];
    if (!room || !people || people.length < 2) return;
    gather(people, room.rect);
    let lines = [];
    if (kind === "council") { feed("Council convened in war room — " + decision.q, "event"); const sp = shuffle(people.slice()); lines = COUNCIL_LINES.slice(0, Math.min(5, sp.length)).map((t, i) => ({ by: sp[i], text: t })); }
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
          S.approvals++; // human-in-the-loop gate (borrowed from Relevance/Munder)
          setTimeout(() => { if (S.approvals > 0) { S.approvals--; feed("Human approved: " + outcome, "event"); } }, randint(6000, 12000));
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
      '<div class="insp-role">' + (ROLES[p.role] || {}).label + " · " + TEAMS[p.team].name + "</div>" +
      '<div class="insp-row"><span class="tag">' + p.years + " yrs</span><span class=\"tag\">" + seniority(p.years) + "</span><span class=\"tag\">" + statusWord(p) + "</span></div>" +
      '<div class="insp-task"><div class="lbl">' + p.ticket + " · assigned work</div><div class=\"val\">" + p.task + "</div>" +
      '<div class="insp-bar"><i style="width:' + Math.min(100, p.progress).toFixed(0) + '%"></i></div><div class="insp-role" style="margin-top:6px">' + Math.min(100, p.progress).toFixed(0) + "% complete</div></div>" +
      '<div class="insp-bio">' + p.bio + "</div>";
  }
  function renderRoomInspector(id) {
    const rm = ROOMS[id], rect = rm.rect, here = S.people.filter((p) => p.x >= rect.tx * TILE && p.x <= (rect.tx + rect.tw) * TILE && p.y >= rect.ty * TILE && p.y <= (rect.ty + rect.th) * TILE);
    const purpose = rm.kind === "break" ? "Breaks & casual cross-team talk." : rm.team ? TEAMS[rm.team].name + "'s own conference room — stand-ups & reviews." : "Shared all-hands — cross-team design & architecture.";
    $("inspector").innerHTML = '<div class="insp-name">' + rm.label + "</div><div class=\"insp-role\">" + purpose + "</div><div class=\"insp-row\"><span class=\"tag\">" + here.length + " here now</span></div><div style=\"margin-top:10px\">" + (here.length ? here.map(rosterRow).join("") : '<div class="insp-role">Empty right now.</div>') + "</div>";
    wireRows();
  }
  function renderTeamInspector(team) {
    const members = S.people.filter((p) => p.team === team);
    $("inspector").innerHTML = '<div class="insp-name"><span class="insp-av" style="background:' + TEAM_COLORS[team] + '">' + TEAMS[team].name.slice(0, 2).toUpperCase() + "</span>" + TEAMS[team].name + "</div>" +
      '<div class="insp-role">' + members.length + " people · own conference: " + (ROOMS["conf_" + team] ? ROOMS["conf_" + team].label : "—") + "</div><div style=\"margin-top:10px\">" + members.map(rosterRow).join("") + "</div>";
    wireRows();
  }
  function renderRoster() {
    const order = ["leadership", "atlas", "nova", "orion", "platform"];
    $("inspector").innerHTML = '<div class="insp-name" style="font-size:13px">Everyone &amp; their work</div><div class="insp-role" style="margin-bottom:8px">' + S.people.length + " people · click a desk, a person, or a team zone</div>" +
      order.map((tid) => '<div class="roster-team"><div class="rt-name" style="color:' + TEAM_COLORS[tid] + '">' + TEAMS[tid].name + "</div>" + S.people.filter((p) => p.team === tid).map(rosterRow).join("") + "</div>").join("");
    wireRows();
  }
  const rosterRow = (p) => '<div class="roster-row" data-id="' + p.id + '"><span class="roster-av" style="background:' + colorOf(p.role) + '">' + initials(p.name) + '</span><span class="rr-name">' + first(p.name) + '</span><span class="rr-meta"><span class="statusdot ' + statusKindClass(p) + '"></span>' + statusWord(p) + "</span></div>";
  function wireRows() { Array.prototype.forEach.call(document.querySelectorAll(".roster-row"), (row) => row.addEventListener("click", () => selectPerson(row.getAttribute("data-id")))); }

  // ---------- interactions ----------
  const inRect = (x, y, rc) => x >= rc.tx * TILE && x <= (rc.tx + rc.tw) * TILE && y >= rc.ty * TILE && y <= (rc.ty + rc.th) * TILE;
  function toLogical(e) { const b = canvas.getBoundingClientRect(); return { x: (e.clientX - b.left) / (b.width / LOGW), y: (e.clientY - b.top) / (b.height / LOGH) }; }
  function personAt(lx, ly) { let best = null, bd = 13; S.people.forEach((p) => { const d = Math.hypot(p.x - lx, p.y - ly - 10); if (d < bd) { bd = d; best = p; } }); return best; }
  function onClick(e) {
    const { x, y } = toLogical(e), p = personAt(x, y);
    if (p) return selectPerson(p.id);
    const rk = Object.keys(ROOMS).find((k) => inRect(x, y, ROOMS[k].rect)); if (rk) { S.selected = rk; S.selectedKind = "room"; return renderInspector(); }
    const z = ZONES.find((zz) => inRect(x, y, zz)); if (z) { S.selected = z.team; S.selectedKind = "team"; return renderInspector(); }
    S.selected = null; S.selectedKind = null; renderInspector();
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
    if (!last) last = t; const dt = Math.min(0.05, (t - last) / 1000); last = t; S.time += dt;
    if (S.auto) {
      const dm = dt * S.speed * MIN_PER_SEC; S.simMin += dm;
      if (S.simMin >= 18 * 60) { S.simMin = 9 * 60; S.day++; S.shippedToday = 0; S.lunchDone = false; S.nextStandup = 9 * 60 + 25; S.nextReview = 9 * 60 + 80; S.nextDecision = 9 * 60 + 140; feed("— Day " + S.day + " begins —", "event"); }
      advance(dm); maybeConversation(dm); schedule(); updateMeetings(); updateTalks();
    }
    moveTick(dt); render(); domTick(); requestAnimationFrame(loop);
  }

  build(); wireControls();
  feed("Office opened — Sprint 1, Day 1. Five team sections online, each with its own conference room.", "event");
  requestAnimationFrame(loop);
})();
