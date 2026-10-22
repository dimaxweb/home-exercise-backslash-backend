# CLAUDE.md

## Project

Backslash backend home exercise: load a microservice graph (Train Ticket, `data/train-ticket-be.json`) and expose a RESTful
query engine that returns renderable graph structures and filters routes between services.

Read the active spec in `docs/superpowers/specs/` before making architectural changes. The wiki (`wiki/`, schema in
`wiki/CLAUDE.md`) holds synthesized knowledge: data quirks, decisions, API reference.

## Primary goal

A small, deterministic, explainable graph query engine with a **generic, pluggable filter mechanism**. Adding a new
route filter must mean adding one filter definition + registering it — no controller or engine changes.

Hard time budget: ~1 hour. YAGNI ruthlessly. No database, no auth, no queues, no LLMs.

## Execution model

Before each task:

1. Read the relevant spec/plan section.
2. Inspect existing code.
3. State the intended change briefly.
4. Implement the smallest complete vertical slice (TDD: failing test first).

After each task:

1. Run lint (if configured), unit tests, build.
2. Fix all failures.
3. Summarize changed files, decisions, limitations.
4. Update the wiki (see `wiki/CLAUDE.md` → "Task completion").

## Development rules

- TypeScript strict mode. Avoid `any`.
- Do not compare against raw string literals for values that have an enum/`as const` set (e.g. node `kind`). Introduce
  one where a closed set of strings is reused.
- Keep controllers/route handlers thin.
- Keep graph algorithms (loading, normalization, path enumeration, filtering) as pure functions — unit-testable without HTTP.
- Validate all HTTP input; unknown filter names → 400 with the list of valid filters.
- Normalize input data at load time (see wiki `domain/graph-data`); never let raw-JSON quirks leak into the engine.
- Every API response is a render-ready graph: `{ nodes, edges }` (+ `routes` where relevant).
- Do not hide failed tests. Do not claim completion unless verification passes.
- Do not install packages without explaining their purpose.
- Record ambiguous decisions in `wiki/pages/decisions/`.

## Reporting format

At the end of each task report: changed files, tests run + result, decisions, limitations.
