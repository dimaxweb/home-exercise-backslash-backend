# Wiki Index

## Domain
- [Assignment](pages/domain/assignment.md) — the exercise requirements and deliverables
- [Train Ticket graph data](pages/domain/graph-data.md) — data shape, counts, sinks, and quirks to normalize

## Architecture
- Design spec: [docs/superpowers/specs/2026-10-22-graph-query-engine-design.md](../docs/superpowers/specs/2026-10-22-graph-query-engine-design.md)
- [Architecture overview](pages/architecture/overview.md) — module layout and the load → routes → filters → views → API flow

## API
- [Route filters](pages/api/filters.md) — RouteFilter contract, built-ins, all/any, how to add a filter
- [REST endpoints](pages/api/endpoints.md) — endpoint table, response shapes, error codes

## Decisions
- [Data normalization](pages/decisions/data-normalization.md) — how raw-JSON quirks are fixed at load
- [Sink definition](pages/decisions/sink-definition.md) — sink = kind rds (SQS excluded)
- [Route definition](pages/decisions/route-definition.md) — maximal entry→terminal paths; why AND of all 3 filters is empty
- [Progressive rendering](pages/decisions/progressive-rendering.md) — AppSec persona, risk-first overview, stateless node expansion for vis-network
