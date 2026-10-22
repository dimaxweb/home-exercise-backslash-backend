# Wiki Index

## Domain
- [Assignment](pages/domain/assignment.md) — the exercise requirements and deliverables
- [Train Ticket graph data](pages/domain/graph-data.md) — data shape, counts, sinks, and quirks to normalize

## Architecture
- Design spec: [docs/superpowers/specs/2026-10-22-graph-query-engine-design.md](../docs/superpowers/specs/2026-10-22-graph-query-engine-design.md) — pages to be filled during implementation

## API
_(filled after the design is approved)_

## Decisions
- [Data normalization](pages/decisions/data-normalization.md) — how raw-JSON quirks are fixed at load
- [Sink definition](pages/decisions/sink-definition.md) — sink = kind rds (SQS excluded)
- [Route definition](pages/decisions/route-definition.md) — maximal entry→terminal paths; why AND of all 3 filters is empty
