---
name: graphify
description: Turn a codebase (plus its docs, schemas, PDFs, images) into a queryable knowledge graph with local deterministic AST parsing. Use to map an unfamiliar repo, find "god nodes" and surprising connections, or answer structural questions before designing or implementing. Requires the graphify engine (see below).
license: MIT
source: https://github.com/Graphify-Labs/graphify
requires_tool: "pip install graphifyy && graphify install"
---

> Pointer skill for [graphify](https://github.com/Graphify-Labs/graphify). Unlike the other vendored
> skills, graphify needs a local engine to do anything — this file is intentionally short.
> Used by the Architect and Developer roles to understand a codebase before changing it.

# Graphify

Graphify builds a knowledge graph of a corpus (code via tree-sitter AST, docs/PDFs/images via an
LLM) so you can ask structural questions instead of re-reading files.

## Activate the engine (one-time)
```bash
pip install graphifyy      # PyPI name is 'graphifyy'; the CLI is 'graphify'
graphify install           # installs the /graphify skill for Claude Code
```

## Use it
```bash
graphify .                                   # build a graph of the current repo
graphify query "what connects the API to the data model?"
graphify path "OrchestratorPM" "Integrator"
graphify . --wiki                            # agent-crawlable wiki (index.md + per-topic articles)
```
Output lands in `graphify-out/` (`graph.html`, `GRAPH_REPORT.md`, `graph.json`, a Wiki, caches).

## When to reach for it
- **Architect:** map module boundaries and data flow before writing `architecture.md`.
- **Developer:** before a bug fix, trace callers/edges of the function you're about to touch.

> If the `graphify` CLI is not installed, say so and fall back to `Grep`/`Glob`/`Read` — do not block.
