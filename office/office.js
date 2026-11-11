/* Office simulation & rendering. Vanilla JS, no deps. Depends on globals in data.js. */
(function () {
  "use strict";

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const randint = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const first = (name) => name.split(" ")[0];
  const initials = (name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colorOf = (role) => TRACK_COLORS[(ROLES[role] || {}).track] || "#64748b";
  const roomById = (id) => ROOMS.find((r) => r.id === id);

  const floor = $("floor");

  // ---------- seat layout ----------
  function seatsFor(room, n) {
    const padX = 22, padTop = 36, padBot = 16;
    const innerW = room.w - padX * 2;
    const innerH = room.h - padTop - padBot;
    let cols = Math.max(1, Math.round(Math.sqrt(n * innerW / Math.max(1, innerH))));
    cols = Math.min(cols, n);
    const rows = Math.ceil(n / cols);
    const cellW = innerW / cols, cellH = innerH / rows;
    const seats = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      seats.push({ x: room.x + padX + cellW * (c + 0.5), y: room.y + padTop + cellH * (r + 0.5) });
    }
    return seats;
  }

  // ---------- state ----------
  const S = {
    people: [],
    byId: {},
    running: true,
    speed: 2,
    simMin: 9 * 60,
    day: 1,
    shippedToday: 0,
    shippedTotal: 0,
    filter: "all",
    selected: null,
    meetings: [],
    talks: [],
    nextStandup: 9 * 60 + 25,
    nextReview: 9 * 60 + 80,
    nextDecision: 9 * 60 + 140,
    lunchDone: false,
    standupTeamIdx: 0,
  };

  const MIN_PER_SEC = 3;

  function verb(p) {
    if (p.status === "meeting") return "In meeting";
    if (p.status === "break") return "On a break";
    const r = p.role;
    if (r === "reviewer") return "Reviewing";
    if (r === "qa" || r === "qa_lead") return "Testing";
    if (r === "designer" || r === "head_design") return "Designing";
    if (r === "architect" || r === "principal_architect") return "Architecting";
    if (r === "pm" || r === "head_product" || r === "director") return "Planning";
    if (r === "integrator" || r === "devops_lead") return "Shipping";
    return "Coding";
  }
  function statusClass(p) {
    if (p.status === "meeting") return "s-meeting";
    if (p.status === "break") return "s-break";
    if (p.role === "reviewer") return "s-review";
    if (p.role === "qa" || p.role === "qa_lead") return "s-testing";
    return "s-working";
  }

  function fillTask(tpl) {
    return tpl.replace("{f}", pick(FEATURES)).replace("{n}", randint(120, 940));
  }
  function assignTask(p) {
    const pool = TASKS_BY_ROLE[p.role] || ["Working on {f}"];
    p.task = fillTask(pick(pool));
    p.progress = rand(3, 28);
    p.rate = (0.5 + p.years / 24) * rand(0.8, 1.3); // %/sim-min, seniors a touch faster
  }

  // ---------- build world ----------
  function build() {
    // rooms
    ROOMS.forEach((room) => {
      const el = document.createElement("div");
      el.className = "room kind-" + room.kind;
      el.id = "room-" + room.id;
      el.style.left = room.x + "px";
      el.style.top = room.y + "px";
      el.style.width = room.w + "px";
      el.style.height = room.h + "px";
      el.innerHTML = '<div class="rlabel">' + room.label + '</div><div class="rcount" id="rc-' + room.id + '"></div>';
      el.addEventListener("click", (e) => { e.stopPropagation(); selectRoom(room.id); });
      floor.appendChild(el);
    });

    // seats per pod (team)
    Object.keys(TEAMS).forEach((teamId) => {
      const team = TEAMS[teamId];
      const members = PEOPLE.filter((p) => p.team === teamId);
      const room = roomById(team.pod);
      const seats = seatsFor(room, members.length);
      members.forEach((person, i) => {
        const p = Object.assign({}, person, {
          homeX: seats[i].x, homeY: seats[i].y,
          x: seats[i].x, y: seats[i].y,
          status: "working", talking: false, busy: false,
        });
        assignTask(p);
        S.people.push(p);
        S.byId[p.id] = p;
      });
    });

    // avatars
    S.people.forEach((p) => {
      const el = document.createElement("div");
      el.className = "person";
      el.id = "person-" + p.id;
      el.innerHTML =
        '<div class="bubble" id="bub-' + p.id + '"></div>' +
        '<div class="av" style="background:' + colorOf(p.role) + '">' + initials(p.name) + "</div>" +
        '<div class="nm">' + first(p.name) + "</div>" +
        '<div class="chip" id="chip-' + p.id + '"></div>' +
        '<div class="bar"><i id="bar-' + p.id + '"></i></div>';
      el.addEventListener("click", (e) => { e.stopPropagation(); selectPerson(p.id); });
      p.el = el;
      p.bub = el.querySelector(".bubble");
      floor.appendChild(el);
      setPos(p);
    });

    floor.addEventListener("click", () => { S.selected = null; renderInspector(); applyFilter(); });

    buildLegend();
    renderInspector();
    fit();
  }

  function setPos(p) { p.el.style.transform = "translate(" + p.x + "px," + p.y + "px)"; }

  function buildLegend() {
    const tracks = [
      ["orchestration", "Orchestration / PM"], ["build", "Architecture / Dev"],
      ["design", "Design"], ["quality", "Review / QA"],
      ["delivery", "DevOps"], ["leadership", "Leadership"],
    ];
    $("legend").innerHTML = tracks.map(function (t) {
      return '<span class="li"><span class="sw" style="background:' + TRACK_COLORS[t[0]] + '"></span>' + t[1] + "</span>";
    }).join("");
  }

  // ---------- clock ----------
  function clockStr(min) {
    min = ((Math.floor(min) % 1440) + 1440) % 1440;
    const h = Math.floor(min / 60), m = Math.floor(min % 60);
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  // ---------- feed ----------
  function feed(text, kind) {
    const ul = $("feed");
    const li = document.createElement("li");
    li.innerHTML = '<span class="ts">' + clockStr(S.simMin) + "</span>" +
      '<span class="' + (kind ? "kind-" + kind : "") + '">' + text + "</span>";
    ul.insertBefore(li, ul.firstChild);
    while (ul.children.length > 70) ul.removeChild(ul.lastChild);
  }

  // ---------- conversations ----------
  function sayLine(p, otherName) {
    const pool = SAY[p.role] || SAY.leadership;
    return fillTask(pick(pool)).replace("{other}", first(otherName));
  }
  function startTalk(a, b) {
    if (a.busy || b.busy || a.talking || b.talking) return;
    const line = sayLine(a, b.name);
    a.talking = b.talking = true;
    a.el.classList.add("talking"); b.el.classList.add("talking");
    a.bub.textContent = line;
    b.bub.textContent = pick(["👍", "Got it.", "Makes sense.", "On it.", "Agreed."]);
    const cross = a.team !== b.team;
    feed('<span class="who" style="color:' + colorOf(a.role) + '">' + first(a.name) + "</span> → " +
      '<span class="who" style="color:' + colorOf(b.role) + '">' + first(b.name) + "</span>" +
      (cross ? ' <span class="ts">[cross-team]</span>' : "") + ": " + line);
    S.talks.push({ a: a, b: b, end: S.simMin + rand(4, 8) });
  }
  function updateTalks() {
    S.talks = S.talks.filter(function (t) {
      if (S.simMin >= t.end) {
        [t.a, t.b].forEach(function (p) { if (!p.busy) { p.talking = false; p.el.classList.remove("talking"); } });
        return false;
      }
      return true;
    });
  }
  function maybeConversation(dm) {
    if (S.talks.length >= 4) return;
    if (Math.random() > dm * 0.03) return;
    const free = S.people.filter(function (p) { return !p.busy && !p.talking && p.status !== "break"; });
    if (free.length < 2) return;
    const a = pick(free);
    let pool = free.filter(function (p) { return p.id !== a.id; });
    // 45% cross-team, else prefer same team
    if (Math.random() < 0.55) {
      const same = pool.filter(function (p) { return p.team === a.team; });
      if (same.length) pool = same;
    } else {
      const diff = pool.filter(function (p) { return p.team !== a.team; });
      if (diff.length) pool = diff;
    }
    startTalk(a, pick(pool));
  }

  // ---------- meetings ----------
  function gather(people, room) {
    const seats = seatsFor(room, people.length);
    people.forEach(function (p, i) {
      p.busy = true; p.status = "meeting"; p.talking = false; p.el.classList.remove("talking");
      p.x = seats[i].x; p.y = seats[i].y; setPos(p);
    });
  }
  function disperse(people) {
    people.forEach(function (p) {
      p.busy = false; p.talking = false; p.el.classList.remove("talking");
      p.status = "working"; p.x = p.homeX; p.y = p.homeY; setPos(p);
    });
  }

  function attendeesFor(kind) {
    if (kind === "design") {
      const designers = S.people.filter(function (p) { return p.role === "designer"; });
      const hd = S.people.filter(function (p) { return p.role === "head_design"; });
      const pm = S.people.filter(function (p) { return p.role === "pm" && !p.busy; });
      const dev = S.people.filter(function (p) { return p.role === "developer" && !p.busy; });
      return hd.concat(designers).concat(pm.slice(0, 1)).concat(dev.slice(0, 1)).filter(nb);
    }
    if (kind === "arch") {
      return S.people.filter(function (p) {
        return (p.role === "architect" || p.role === "principal_architect") && !p.busy;
      });
    }
    return [];
  }
  function nb(p) { return !p.busy; }

  function startMeeting(kind, teamId) {
    let label, room, people, lines = [], decision = null, dur;
    if (kind === "standup") {
      const team = TEAMS[teamId];
      room = roomById(team.pod); // stand-ups happen at the pod
      people = S.people.filter(function (p) { return p.team === teamId && !p.busy; });
      label = team.name + " stand-up";
      dur = 18;
    } else if (kind === "design") {
      room = roomById("everest"); people = attendeesFor("design"); label = "Design review"; dur = 40;
    } else if (kind === "arch") {
      room = roomById("fuji"); people = attendeesFor("arch"); label = "Architecture sync"; dur = 38;
    } else if (kind === "lunch") {
      room = roomById("cafeteria");
      people = shuffle(S.people.filter(nb)).slice(0, randint(4, 7)); label = "Lunch"; dur = 45;
    } else if (kind === "council") {
      room = roomById("warroom");
      people = S.people.filter(function (p) { return p.team === "leadership"; });
      decision = pick(DECISIONS); label = "Decision council"; dur = 55;
    }
    if (!people || people.length < 2) return;

    gather(people, room);
    if (kind === "council") {
      feed("Council convened — " + decision.q, "event");
      const speakers = shuffle(people.slice());
      lines = COUNCIL_LINES.slice(0, Math.min(5, speakers.length)).map(function (t, i) {
        return { by: speakers[i], text: t };
      });
    } else if (kind === "lunch") {
      feed(label + " — " + people.map(function (p) { return first(p.name); }).join(", "), "event");
    } else {
      feed(label + " started in " + room.label + " (" + people.length + ")", "event");
      lines = shuffle(people.slice()).slice(0, 3).map(function (p) {
        return { by: p, text: sayLine(p, pick(people).name) };
      });
    }

    const m = {
      kind: kind, label: label, room: room, people: people, decision: decision,
      lines: lines, nextLine: S.simMin + 3, gap: Math.max(3, dur / (lines.length + 1)),
      end: S.simMin + dur,
    };
    if (kind === "break") people.forEach(function (p) { p.status = "break"; });
    S.meetings.push(m);
  }

  function updateMeetings() {
    S.meetings = S.meetings.filter(function (m) {
      // emit a scripted line
      if (m.lines.length && S.simMin >= m.nextLine) {
        const ln = m.lines.shift();
        const sp = ln.by;
        sp.bub.textContent = ln.text;
        sp.el.classList.add("talking");
        feed('<span class="who" style="color:' + colorOf(sp.role) + '">' + first(sp.name) + "</span> (" +
          m.label + "): " + ln.text);
        // clear the previous speakers' bubbles
        m.people.forEach(function (p) { if (p !== sp) p.el.classList.remove("talking"); });
        m.nextLine = S.simMin + m.gap;
      }
      if (S.simMin >= m.end) {
        if (m.kind === "council" && m.decision) {
          const outcome = pick(m.decision.options);
          const consensus = randint(4, m.people.length);
          const conf = randint(74, 96);
          feed("Decision: " + outcome + " — consensus " + consensus + "/" + m.people.length +
            ", confidence " + conf + "%", "decision");
          S.lastDecision = { q: m.decision.q, outcome: outcome, consensus: consensus, conf: conf };
        }
        disperse(m.people);
        return false;
      }
      return true;
    });
  }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = randint(0, i);[a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- scheduling ----------
  function schedule() {
    if (S.simMin >= S.nextStandup) {
      const teams = ["atlas", "nova", "orion"];
      startMeeting("standup", teams[S.standupTeamIdx % teams.length]);
      S.standupTeamIdx++;
      S.nextStandup += 95;
    }
    if (S.simMin >= S.nextReview) {
      startMeeting(Math.random() < 0.5 ? "design" : "arch");
      S.nextReview += 150;
    }
    if (S.simMin >= S.nextDecision) {
      startMeeting("council");
      S.nextDecision += 260;
    }
    if (!S.lunchDone && S.simMin >= 12 * 60 + 30) { startMeeting("lunch"); S.lunchDone = true; }
  }

  // ---------- work progress ----------
  function advance(dm) {
    S.people.forEach(function (p) {
      if (p.busy || p.status === "break") return;
      p.progress += p.rate * dm;
      if (p.progress >= 100) {
        feed('<span class="who" style="color:' + colorOf(p.role) + '">' + first(p.name) +
          "</span> finished: " + p.task, "ship");
        S.shippedToday++; S.shippedTotal++;
        assignTask(p);
      }
    });
  }

  // ---------- render per frame ----------
  let lastMinShown = -1;
  function render() {
    S.people.forEach(function (p) {
      const chip = $("chip-" + p.id);
      if (chip) chip.innerHTML = '<span class="statusdot ' + statusClass(p) + '"></span>' + verb(p);
      const bar = $("bar-" + p.id);
      if (bar) {
        bar.style.width = Math.min(100, p.progress).toFixed(0) + "%";
        bar.style.background = p.status === "meeting" ? "var(--warn)" : "var(--ok)";
      }
      p.el.title = p.name + " · " + (ROLES[p.role] || {}).label + " — " + p.task;
    });

    if (Math.floor(S.simMin) !== lastMinShown) {
      lastMinShown = Math.floor(S.simMin);
      $("clock").textContent = clockStr(S.simMin);
    }

    // room occupancy counts
    const counts = {};
    S.people.forEach(function (p) {
      ROOMS.forEach(function (r) {
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) counts[r.id] = (counts[r.id] || 0) + 1;
      });
    });
    ROOMS.forEach(function (r) { const el = $("rc-" + r.id); if (el) el.textContent = counts[r.id] ? counts[r.id] + "" : ""; });

    // board
    let working = 0, review = 0, testing = 0, meeting = 0;
    S.people.forEach(function (p) {
      if (p.status === "meeting") meeting++;
      else if (p.status === "break") { }
      else if (p.role === "reviewer") review++;
      else if (p.role === "qa" || p.role === "qa_lead") testing++;
      else working++;
    });
    $("board").innerHTML =
      stat(working, "On their task") +
      stat(review, "In review") +
      stat(testing, "Testing") +
      stat(meeting, "In meeting", "warn") +
      stat(S.shippedToday, "Shipped today", "ok");

    if (S.selected && S.selectedKind === "person") renderPersonInspector(S.byId[S.selected]);
  }
  function stat(n, label, cls) {
    return '<div class="stat ' + (cls || "") + '"><b>' + n + "</b><span>" + label + "</span></div>";
  }

  // ---------- inspector ----------
  function selectPerson(id) {
    S.selected = id; S.selectedKind = "person";
    S.people.forEach(function (p) { p.el.classList.toggle("selected", p.id === id); });
    ROOMS.forEach(function (r) { const el = $("room-" + r.id); if (el) el.classList.remove("active"); });
    renderInspector();
  }
  function selectRoom(id) {
    S.selected = id; S.selectedKind = "room";
    S.people.forEach(function (p) { p.el.classList.remove("selected"); });
    ROOMS.forEach(function (r) { const el = $("room-" + r.id); if (el) el.classList.toggle("active", r.id === id); });
    renderInspector();
  }
  function renderInspector() {
    if (S.selectedKind === "person" && S.byId[S.selected]) return renderPersonInspector(S.byId[S.selected]);
    if (S.selectedKind === "room") return renderRoomInspector(S.selected);
    renderRoster();
  }
  function seniority(y) { return y >= 16 ? "Director" : y >= 12 ? "Principal" : y >= 8 ? "Staff" : y >= 5 ? "Senior" : "Mid"; }
  function renderPersonInspector(p) {
    if (!p) return;
    $("inspector").innerHTML =
      '<div class="insp-name"><span class="insp-av" style="background:' + colorOf(p.role) + '">' + initials(p.name) + "</span>" + p.name + "</div>" +
      '<div class="insp-role">' + (ROLES[p.role] || {}).label + " · " + TEAMS[p.team].name + "</div>" +
      '<div class="insp-row"><span class="tag">' + p.years + " yrs experience</span><span class=\"tag\">" + seniority(p.years) + "</span>" +
      '<span class="tag"><span class="statusdot ' + statusClass(p) + '"></span>' + verb(p) + "</span></div>" +
      '<div class="insp-task"><div class="lbl">Assigned work</div><div class="val">' + p.task + "</div>" +
      '<div class="insp-bar"><i style="width:' + Math.min(100, p.progress).toFixed(0) + '%"></i></div>' +
      '<div class="sub muted" style="margin-top:6px">' + Math.min(100, p.progress).toFixed(0) + "% complete</div></div>" +
      '<div class="insp-bio">' + p.bio + "</div>";
  }
  function renderRoomInspector(id) {
    const r = roomById(id);
    const here = S.people.filter(function (p) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; });
    const purpose = {
      lobby: "Reception & drop-in chats.", cafeteria: "Breaks and casual cross-team talk.",
      focus: "Quiet deep-work desks.", everest: "Design & cross-team reviews.",
      fuji: "Architecture syncs.", warroom: "The decision council meets here.",
    }[id] || "Team desks — where the assigned work gets done.";
    $("inspector").innerHTML =
      '<div class="insp-name">' + r.label + "</div>" +
      '<div class="insp-role">' + purpose + "</div>" +
      '<div class="insp-row"><span class="tag">' + here.length + " here now</span></div>" +
      '<div style="margin-top:10px">' + (here.length ? here.map(function (p) {
        return '<div class="roster-row" data-id="' + p.id + '"><span class="roster-av" style="background:' + colorOf(p.role) +
          '">' + initials(p.name) + '</span><span class="rr-name">' + first(p.name) + '</span><span class="rr-meta">' + verb(p) + "</span></div>";
      }).join("") : '<div class="muted">Empty right now.</div>') + "</div>";
    wireRosterRows();
  }
  function renderRoster() {
    const order = ["leadership", "atlas", "nova", "orion", "platform"];
    $("inspector").innerHTML =
      '<div class="insp-name" style="font-size:14px">Everyone & their work</div>' +
      '<div class="sub muted" style="margin-bottom:8px">' + S.people.length + " people · click anyone to inspect</div>" +
      order.map(function (tid) {
        const members = S.people.filter(function (p) { return p.team === tid; });
        return '<div class="roster-team"><div class="rt-name">' + TEAMS[tid].name + "</div>" +
          members.map(function (p) {
            return '<div class="roster-row" data-id="' + p.id + '"><span class="roster-av" style="background:' + colorOf(p.role) + '">' +
              initials(p.name) + '</span><span class="rr-name">' + first(p.name) + '</span>' +
              '<span class="rr-meta"><span class="statusdot ' + statusClass(p) + '"></span>' + verb(p) + "</span></div>";
          }).join("") + "</div>";
      }).join("");
    wireRosterRows();
  }
  function wireRosterRows() {
    Array.prototype.forEach.call(document.querySelectorAll(".roster-row"), function (row) {
      row.addEventListener("click", function () { selectPerson(row.getAttribute("data-id")); });
    });
  }

  // ---------- filter ----------
  function applyFilter() {
    S.people.forEach(function (p) {
      p.el.classList.toggle("dim", S.filter !== "all" && p.team !== S.filter);
    });
  }

  // ---------- fit to viewport ----------
  function fit() {
    const stage = $("stage");
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const scale = Math.min(sw / 1200, sh / 700);
    const tx = Math.max(0, (sw - 1200 * scale) / 2);
    const ty = Math.max(0, (sh - 700 * scale) / 2);
    floor.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
  }

  // ---------- controls ----------
  function wireControls() {
    $("btnPlay").addEventListener("click", function () {
      S.running = !S.running; this.textContent = S.running ? "Pause" : "Resume";
    });
    $("speed").addEventListener("change", function () { S.speed = parseFloat(this.value); });
    $("teamFilter").addEventListener("change", function () { S.filter = this.value; applyFilter(); });
    $("btnStandup").addEventListener("click", function () {
      const teams = ["atlas", "nova", "orion"];
      startMeeting("standup", teams[S.standupTeamIdx++ % teams.length]);
    });
    $("btnCouncil").addEventListener("click", function () { startMeeting("council"); });
    window.addEventListener("resize", fit);
  }

  // ---------- loop ----------
  let last = 0;
  function loop(t) {
    if (!last) last = t;
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (S.running) {
      const dm = dt * S.speed * MIN_PER_SEC;
      S.simMin += dm;
      if (S.simMin >= 18 * 60) { // end of day
        S.simMin = 9 * 60; S.day++; S.shippedToday = 0; S.lunchDone = false;
        S.nextStandup = 9 * 60 + 25; S.nextReview = 9 * 60 + 80; S.nextDecision = 9 * 60 + 140;
        feed("— Day " + S.day + " begins —", "event");
      }
      advance(dm);
      maybeConversation(dm);
      schedule();
      updateMeetings();
      updateTalks();
      render();
    }
    requestAnimationFrame(loop);
  }

  // ---------- go ----------
  build();
  wireControls();
  feed("Office opened — Sprint 1, Day 1. Everyone is on their assigned work.", "event");
  requestAnimationFrame(loop);
})();
