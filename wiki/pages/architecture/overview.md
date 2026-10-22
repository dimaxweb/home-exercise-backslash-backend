---
title: Architecture overview
category: architecture
tags: [architecture, modules, flow]
sources: [docs/superpowers/specs/2026-10-22-graph-query-engine-design.md, docs/superpowers/plans/2026-10-22-graph-query-engine.md]
updated: 2026-10-22
---

## Flow

`load → routes → filters → views → API`. Everything runs once at startup except filters and views, which run per
request. Only `src/api/` and `src/main.ts` do I/O; everything else is pure.

1. **Load** (`graph/load-graph.ts`): zod validates raw JSON, then normalizes it (string `to`, dangling targets,
   defaults, edge dedup; see [[data-normalization]]). It returns `{ graph, warnings }`, so the caller decides whether to log.
2. **Routes** (`graph/routes.ts`): `enumerateRoutes` finds the maximal entry→terminal paths and guards against cycles
   ([[route-definition]]). `routeEdges` turns a route into its edges.
3. **Filters** (`filters/`): pluggable `RouteFilter`s in a `FilterRegistry` ([[filters]]).
4. **Query** (`query/query-routes.ts`): `queryRoutes` with `match=all|any`.
5. **Views** (`view/`): render-ready `{ nodes, edges }` for vis-network.
6. **API** (`api/`): a thin Express layer with zod query validation.

## Module layout

```
src/graph/types.ts       NodeKind, Severity, SINK_KINDS, severityRank, interfaces, edgeId, routeId
src/graph/node-risk.ts   isSink, isVulnerable, maxSeverity
src/graph/load-graph.ts  raw schema + normalize
src/graph/routes.ts      enumerateRoutes, routeEdges
src/filters/*            RouteFilter, FilterRegistry, built-ins
src/query/query-routes.ts
src/view/*               toView, overview, expand
src/api/*                query schemas, createApp
src/engine.ts            createEngine(raw): deps + warnings
src/main.ts              read file, listen
```

## Graph representation

`Graph = { nodes: Map<id, GraphNode>, edges: GraphEdge[], out, in }`. `out` and `in` are adjacency lists with an
entry for every node, including isolated ones. Edge ids are `${from}->${to}`. Route ids are node ids joined with `>`.
