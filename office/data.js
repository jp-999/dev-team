/* Office data: the org, the floor plan, and the content the simulation draws from.
 * Plain globals (classic script) so the app runs from file:// with no build step. */

/* ---- Roles & colors (aligned with the repo's role tracks) ---- */
const TRACK_COLORS = {
  orchestration: "#3b82f6",
  build: "#2563eb",
  design: "#a855f7",
  quality: "#10b981",
  delivery: "#f59e0b",
  leadership: "#334155",
};

const ROLES = {
  director:            { label: "Director of Engineering", track: "leadership" },
  head_product:        { label: "Head of Product",          track: "orchestration" },
  head_design:         { label: "Head of Design",           track: "design" },
  principal_architect: { label: "Principal Architect",      track: "build" },
  qa_lead:             { label: "QA Lead",                  track: "quality" },
  devops_lead:         { label: "DevOps Lead",              track: "delivery" },
  pm:                  { label: "PM / Orchestrator",        track: "orchestration" },
  architect:           { label: "Architect",               track: "build" },
  designer:            { label: "Designer (UX)",            track: "design" },
  senior_dev:          { label: "Senior Developer",         track: "build" },
  developer:           { label: "Developer",               track: "build" },
  reviewer:            { label: "Code Reviewer",            track: "quality" },
  qa:                  { label: "QA / Tester",             track: "quality" },
  integrator:          { label: "DevOps / Integrator",      track: "delivery" },
};

/* ---- Teams (each maps to a desk pod on the floor) ---- */
const TEAMS = {
  leadership: { name: "Leadership",  pod: "leadership" },
  atlas:      { name: "Team Atlas",  pod: "atlas" },
  nova:       { name: "Team Nova",   pod: "nova" },
  orion:      { name: "Team Orion",  pod: "orion" },
  platform:   { name: "Platform",    pod: "platform" },
};

/* ---- People: everyone is 3+ years; leads & leadership are more senior ---- */
const PEOPLE = [
  // Leadership — the decision council
  { id: "p01", name: "Dana Whitaker",  role: "director",            team: "leadership", years: 18, bio: "Runs engineering across all squads. Breaks ties and owns the big calls." },
  { id: "p02", name: "Marcus Lindqvist", role: "head_product",      team: "leadership", years: 16, bio: "Head of Product. Guards scope and keeps every team pointed at outcomes." },
  { id: "p03", name: "Priya Raman",    role: "head_design",         team: "leadership", years: 15, bio: "Head of Design. Owns the design system and the quality bar for UX." },
  { id: "p04", name: "Hiroshi Tanaka", role: "principal_architect", team: "leadership", years: 17, bio: "Principal Architect. Final word on cross-team technical decisions." },
  { id: "p05", name: "Fatima Noor",    role: "qa_lead",             team: "leadership", years: 12, bio: "QA Lead. Sets the testing strategy and the definition of done." },
  { id: "p06", name: "Diego Alvarez",  role: "devops_lead",         team: "leadership", years: 13, bio: "DevOps Lead. Owns CI/CD, releases, and production health." },

  // Team Atlas
  { id: "p07", name: "Sofia Moreno",   role: "pm",        team: "atlas", years: 9,  bio: "Atlas PM. Turns requests into a scoped plan and runs the merge gate." },
  { id: "p08", name: "Arjun Mehta",    role: "architect", team: "atlas", years: 10, bio: "Atlas Architect. Designs interfaces and the data model." },
  { id: "p09", name: "Lena Fischer",   role: "designer",  team: "atlas", years: 7,  bio: "Atlas Designer. Flows, screens, and accessible components." },
  { id: "p10", name: "Noah Becker",    role: "senior_dev",team: "atlas", years: 8,  bio: "Atlas Senior Dev. Mentors and owns the trickiest implementation." },
  { id: "p11", name: "Maya Nakamura",  role: "developer", team: "atlas", years: 4,  bio: "Atlas Developer. Ships features against the design and contracts." },
  { id: "p12", name: "Tomas Oliveira", role: "reviewer",  team: "atlas", years: 9,  bio: "Atlas Reviewer. Independent gate for correctness and security." },
  { id: "p13", name: "Grace Okoye",    role: "qa",        team: "atlas", years: 5,  bio: "Atlas QA. Writes and runs the tests that prove acceptance." },

  // Team Nova
  { id: "p14", name: "Daniel Haddad",  role: "pm",        team: "nova", years: 10, bio: "Nova PM. Coordinates the pipeline and protects the sprint scope." },
  { id: "p15", name: "Ingrid Larsen",  role: "architect", team: "nova", years: 11, bio: "Nova Architect. Favors the simplest design that meets the spec." },
  { id: "p16", name: "Kofi Mensah",    role: "designer",  team: "nova", years: 6,  bio: "Nova Designer. Prototypes flows and keeps the UI consistent." },
  { id: "p17", name: "Yuki Sato",      role: "senior_dev",team: "nova", years: 9,  bio: "Nova Senior Dev. Hardens services and reviews risky changes." },
  { id: "p18", name: "Liam Walsh",     role: "developer", team: "nova", years: 3,  bio: "Nova Developer. Newest on the team, fast on well-scoped tasks." },
  { id: "p19", name: "Carla Ricci",    role: "reviewer",  team: "nova", years: 8,  bio: "Nova Reviewer. Catches edge cases before they reach QA." },
  { id: "p20", name: "Omar Khan",      role: "qa",        team: "nova", years: 6,  bio: "Nova QA. Regression suites and sharp repro steps." },

  // Team Orion
  { id: "p21", name: "Hana Kim",       role: "pm",        team: "orion", years: 9,  bio: "Orion PM. Keeps the plan proportional and the gates honest." },
  { id: "p22", name: "Pavel Novak",    role: "architect", team: "orion", years: 12, bio: "Orion Architect. Deep on data modeling and performance." },
  { id: "p23", name: "Zoe Clarke",     role: "designer",  team: "orion", years: 5,  bio: "Orion Designer. Obsesses over empty, loading, and error states." },
  { id: "p24", name: "Rafael Souza",   role: "senior_dev",team: "orion", years: 8,  bio: "Orion Senior Dev. Reliable on integrations and refactors." },
  { id: "p25", name: "Aisha Siddiqui", role: "developer", team: "orion", years: 4,  bio: "Orion Developer. Strong on frontend wiring and polish." },
  { id: "p26", name: "Elena Petrova",  role: "reviewer",  team: "orion", years: 10, bio: "Orion Reviewer. Security-minded, precise, cites line numbers." },
  { id: "p27", name: "Ben Carter",     role: "qa",        team: "orion", years: 5,  bio: "Orion QA. Turns acceptance criteria into executable tests." },

  // Platform
  { id: "p28", name: "Victor Hugo",    role: "integrator", team: "platform", years: 7, bio: "Platform. Owns the build/release pipeline and smoke tests." },
  { id: "p29", name: "Nadia Haroun",   role: "integrator", team: "platform", years: 6, bio: "Platform/SRE. Deploys, migrations, and rollback safety." },
];

/* ---- Floor plan: rooms in a 1200 x 700 coordinate space ---- */
const ROOMS = [
  { id: "lobby",      label: "Lobby",                 kind: "common",  x: 20,  y: 20,  w: 200, h: 150 },
  { id: "cafeteria",  label: "Cafeteria \u00b7 The Hub", kind: "break", x: 20,  y: 185, w: 200, h: 215 },
  { id: "focus",      label: "Focus Zone",            kind: "common",  x: 20,  y: 415, w: 200, h: 165 },

  { id: "atlas",      label: "Team Atlas",            kind: "pod",     x: 240, y: 20,  w: 300, h: 250 },
  { id: "nova",       label: "Team Nova",             kind: "pod",     x: 560, y: 20,  w: 300, h: 250 },
  { id: "orion",      label: "Team Orion",            kind: "pod",     x: 240, y: 290, w: 300, h: 250 },
  { id: "platform",   label: "Platform Bay",          kind: "pod",     x: 560, y: 290, w: 300, h: 120 },
  { id: "leadership", label: "Leadership Row",        kind: "pod",     x: 240, y: 560, w: 620, h: 120 },

  { id: "everest",    label: "Conf \u00b7 Everest",     kind: "meeting", x: 880, y: 20,  w: 300, h: 180 },
  { id: "fuji",       label: "Conf \u00b7 Fuji",        kind: "meeting", x: 880, y: 215, w: 300, h: 150 },
  { id: "warroom",    label: "War Room \u00b7 Council",  kind: "meeting", x: 880, y: 380, w: 300, h: 200 },
];

/* ---- Content the sim draws from ---- */
const FEATURES = [
  "Checkout v2", "Billing portal", "Search revamp", "Notifications",
  "Onboarding", "Mobile sync", "Admin console", "Audit log",
];

// Assigned work per role. {f} = feature, {n} = number.
const TASKS_BY_ROLE = {
  pm:                  ["Writing the PRD for {f}", "Grooming the {f} backlog", "Refining sprint scope", "Updating the roadmap"],
  architect:           ["Designing the {f} data model", "Defining {f} service contracts", "Spiking the caching layer", "Reviewing the {f} API spec"],
  designer:            ["Prototyping the {f} flow", "Designing {f} empty states", "Running an a11y pass on {f}", "Polishing design tokens"],
  senior_dev:          ["Implementing {f} core logic", "Hardening the {f} service", "Mentoring on {f}", "Refactoring the auth module"],
  developer:           ["Implementing the {f} endpoint", "Wiring {f} UI to the API", "Fixing pagination bug #{n}", "Adding {f} validation"],
  reviewer:            ["Reviewing PR #{n} ({f})", "Security pass on {f}", "Reviewing the {f} migration", "Checking error handling in {f}"],
  qa:                  ["Writing tests for {f}", "Running the {f} regression suite", "Reproducing bug #{n}", "Verifying {f} acceptance"],
  integrator:          ["Updating the CI pipeline", "Cutting the {f} release candidate", "Smoke-testing the deploy", "Rotating secrets"],
  director:            ["Reviewing squad OKRs", "Unblocking cross-team deps", "Prepping the board update", "Planning headcount"],
  head_product:        ["Prioritizing the roadmap", "Reviewing {f} metrics", "Aligning stakeholders on {f}", "Scoping next quarter"],
  head_design:         ["Reviewing {f} designs", "Evolving the design system", "Running a design critique", "Auditing UX consistency"],
  principal_architect: ["Reviewing cross-team contracts", "Writing an ADR for {f}", "Assessing {f} scalability", "Standardizing service patterns"],
  qa_lead:             ["Setting the {f} test strategy", "Triaging flaky tests", "Reviewing coverage reports", "Tuning the QA gate"],
  devops_lead:         ["Reviewing the deploy pipeline", "Planning the {f} rollout", "Checking production health", "Running an incident review"],
};

// Short things people say to each other. {f} = feature, {other} = the other person's first name.
const SAY = {
  developer:  ["{other}, can you review my PR for {f}?", "Pushed the {f} fix — tests are green.", "The {f} contract changed, updating now."],
  senior_dev: ["Let's pair on the tricky part of {f}.", "I'd keep {f} backwards-compatible.", "Nice catch on {f}, shipping the fix."],
  reviewer:   ["Left comments on {f} — one blocker on error handling.", "{f} looks good, approving once tests pass.", "Watch the input validation in {f}."],
  qa:         ["Repro'd the {f} bug, steps are in the ticket.", "{f} acceptance is green across the board.", "Edge case on {f} fails — sending it back."],
  designer:   ["Updated the {f} flow — the empty state changed.", "Can we align {f} on the shared tokens?", "{other}, does {f} fit the grid?"],
  architect:  ["Let's version the {f} API instead of breaking it.", "{f} data model is ready for implementation.", "Keep {f} behind an interface for now."],
  pm:         ["How's {f} tracking for the sprint?", "{other}, any blockers on {f}?", "Scope for {f} is locked — let's ship."],
  integrator: ["{f} release candidate is building now.", "Deploy for {f} smoke-tested clean.", "Holding the release — one check is red."],
  leadership: ["Let's sync on the shared {f} API so we don't duplicate work.", "Great progress on {f} this sprint.", "Bring {f} to the council if it's contentious."],
};

const MEETINGS = [
  { id: "standup",  label: "Stand-up",        room: null,      pick: "team" },
  { id: "design",   label: "Design review",   room: "everest", pick: "design" },
  { id: "arch",     label: "Architecture sync", room: "fuji",  pick: "arch" },
  { id: "lunch",    label: "Lunch",           room: "cafeteria", pick: "random" },
];

const DECISIONS = [
  { q: "Adopt the new design system org-wide?",       options: ["Adopt now", "Pilot on one team first"] },
  { q: "Postgres or DynamoDB for the Billing portal?", options: ["Postgres", "DynamoDB"] },
  { q: "Ship Checkout v2 behind a feature flag?",      options: ["Ship behind a flag", "Hold for more QA"] },
  { q: "Freeze scope for the release this Friday?",    options: ["Freeze scope", "Allow one more feature"] },
  { q: "Split the monolith's search module out?",      options: ["Extract a service", "Keep it in the monolith"] },
];

const COUNCIL_LINES = [
  "From a product angle, the outcome matters more than the mechanism.",
  "Technically both work; the second is cheaper to operate.",
  "Design-wise, consistency wins — users feel the difference.",
  "QA prefers the option we can test deterministically.",
  "Ops can support either, but one has a cleaner rollback.",
  "Given the data, I'd lean to the lower-risk path.",
];
