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

## Views

Every response graph goes through one pure function, `toView(graph, nodeIds, edges)`, in `view/to-view.ts`. It:

- dedups edges by id and always includes both endpoints of every edge;
- adds the vis-network fields `label` (= id) and `group` (= kind), plus `risk: { public, vulnerable, maxSeverity, sink }`;
- adds `hidden: { in, out }`, the number of the node's graph edges that are **not in this response**. The UI shows
  this count as an "expand (+n)" badge. It is relative to the one response, so after several merges on the client it
  can overstate what is still hidden.

`viewOfRoutes` is the union of the nodes and edges of a set of routes. `/routes` uses it.

### Overview (`view/overview.ts`)

1. Seeds, in [[progressive-rendering]] priority (D10): vulnerable nodes (worst severity first), then public nodes,
   then sinks. Each group is ordered by id. Seeds are added until `maxNodes` is reached.
2. Risk routes are routes with a vulnerable node. They are ranked by max severity desc, then starts public, then ends
   in sink, then route id.
3. A route is added only if all of its new nodes fit under `maxNodes`. Otherwise it is skipped and `truncated = true`.
4. Edges come only from included routes, so a seed with no included route has no edges.

Defaults: `DEFAULT_MAX_NODES = 50`, `MAX_NODES_LIMIT = 500`.

### Expansion (`view/expand.ts`)

`expandNode(graph, id, in|out|both)` returns the node, its one-hop neighbors and the connecting edges. It is
stateless; the client merges the result by id. An unknown id returns `undefined`, which the API turns into a 404.
