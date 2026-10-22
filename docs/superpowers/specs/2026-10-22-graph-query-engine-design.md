# Graph Query Engine — Design Spec

Date: 2026-10-22 · Status: draft for review · Budget: ~1 hour total

## 1. Goal

Load `data/train-ticket-be.json` (Train Ticket microservice graph) and expose a REST API that:

- returns the graph in a render-ready shape (`{ nodes, edges }`), and
- filters **routes** using composable, pluggable filters. The three built-in filters are: starts in a public service,
  ends in a sink, and has a vulnerable node.

Adding a filter = write one `RouteFilter` object + register it. No changes to the engine, the API, or the validation.

## 2. Decisions (approved 2026-10-22)

| # | Decision | Choice |
|---|---|---|
| D1 | Stack | Node + TypeScript (strict), Express, zod (input/data validation), Jest + ts-jest + supertest |
| D2 | Sink | `kind ∈ SINK_KINDS = { rds }`. `sqs` is a queue, not a sink. Extending the set is a one-line change |
| D3 | Combining filters | `match=all` (AND, default) or `match=any` (OR) |
| D4 | Dangling edge target (`assurance-service`) | Synthesize `{ name, kind: service, inferred: true }`, log a warning |
| D5 | Definition of a route | A **maximal path**: from an entry node (in-degree 0) to a terminal node (out-degree 0), following edge direction. An isolated node is a 1-node route |
| D6 | Cycles | Data is acyclic, but enumeration tracks the nodes on the current path and stops instead of looping. A cycle-truncated route ends at the last node before the repeat |
| D7 | Storage | In-memory. Graph and routes are computed once at startup (222 routes; cheap) |

Rationale for D5: maximal paths are "complete call flows". Enumerating every sub-path (440 here) duplicates prefixes and
adds noise for a renderer. Trade-off: a filter like "ends in sink" only sees routes that start at an entry point. That is
acceptable because every sink is reachable from some entry point.

## 3. Data normalization (load time)

Raw quirks (see `wiki/pages/domain/graph-data.md`):

1. `edge.to` may be a string → wrap it in an array.
2. Edge targets/sources missing from `nodes` → synthesized node (D4).
3. Optional `publicExposed` → `false`, `vulnerabilities` → `[]`.
4. Duplicate edges are deduplicated.

Raw JSON is validated with a zod schema. If it is invalid, startup fails fast with a clear error.

## 4. Domain model

```ts
const NodeKind = { Service: 'service', Rds: 'rds', Sqs: 'sqs' } as const;   // unknown kinds pass through as string
interface Vulnerability { file: string; severity: string; message: string; metadata?: Record<string, unknown> }
interface GraphNode {
  id: string; kind: string; language?: string; path?: string;
  publicExposed: boolean; vulnerabilities: Vulnerability[];
  metadata?: Record<string, unknown>; inferred?: boolean;
}
interface GraphEdge { id: string /* `${source}->${target}` */; source: string; target: string }
interface Graph { nodes: Map<string, GraphNode>; edges: GraphEdge[]; out: Map<string, string[]>; in: Map<string, string[]> }
type Route = string[];                     // ordered node ids
```

## 5. Filter mechanism (the extensibility point)

```ts
interface RouteFilter {
  name: string;                            // kebab-case, used in the query string
  description: string;
  matches(route: Route, graph: Graph): boolean;   // pure
}
class FilterRegistry { register(f); get(name); list(); }
```

Built-ins (`src/filters/built-in.ts`):

| name | matches when |
|---|---|
| `starts-public` | first node `publicExposed === true` |
| `ends-in-sink` | last node kind ∈ `SINK_KINDS` |
| `has-vulnerability` | some node has `vulnerabilities.length > 0` |

Engine: `queryRoutes(graph, routes, filters, match)` keeps the routes where `filters.every(...)` (all) or `filters.some(...)`
(any) is true. With no filters it returns all routes.

## 6. REST API

All responses are JSON. Nodes and edges are flat arrays, which suits Cytoscape, vis-network, React Flow, and d3.

| Method & path | Response |
|---|---|
| `GET /health` | `{ status: "ok" }` |
| `GET /graph` | `{ nodes: GraphNode[], edges: GraphEdge[] }`, the full graph |
| `GET /filters` | `[{ name, description }]`, for client discoverability |
| `GET /routes?filters=a,b&match=all\|any` | `RoutesResponse` below |

```ts
interface RoutesResponse {
  nodes: GraphNode[];        // union of nodes on the matched routes
  edges: GraphEdge[];        // union of edges on the matched routes
  routes: { id: string; nodes: string[] }[];   // id = nodes.join('>')
  meta: { filters: string[]; match: 'all' | 'any'; totalRoutes: number; matchedRoutes: number };
}
```

`filters` also accepts the repeated form (`?filters=a&filters=b`).

Errors: an unknown filter or an invalid `match` returns `400 { error, validFilters }`. An unknown URL path returns `404 { error }`.

Expected results on the real data: `starts-public` → 6 routes, `ends-in-sink` → 30, all three ANDed → 0
(no public node reaches `prod-postgresdb`, which is a property of the data). README documents this.

## 7. Module layout

```
src/
  graph/types.ts         # NodeKind, SINK_KINDS, interfaces
  graph/load-graph.ts    # zod raw schema + normalize → Graph
  graph/routes.ts        # enumerateRoutes(graph): Route[]
  graph/to-view.ts       # subgraph view for a set of routes / whole graph
  filters/types.ts       # RouteFilter
  filters/registry.ts    # FilterRegistry
  filters/built-in.ts    # the 3 built-in filters + defaultRegistry()
  query/query-routes.ts  # queryRoutes (pure)
  api/app.ts             # createApp({ graph, routes, registry }): express.Application
  main.ts                # load file, build app, listen on PORT (default 3000)
```

Everything except `api/` and `main.ts` is pure and has no I/O.

## 8. Testing (TDD)

- Unit, on small hand-built fixtures: normalization (string `to`, dangling target, defaults, dedup); route enumeration
  (branching, isolated node, cycle guard); each built-in filter; `all` vs `any`; view building (union, no duplicate edges).
- API (supertest): each endpoint, the comma and repeated filter forms, 400 for an unknown filter and for a bad `match`.
- One smoke test against the real JSON with the counts from §6.

## 9. Deliverables

- `README.md`: how to run, API examples, decisions and assumptions (D1–D7, the data quirks, the empty AND result), and
  how to add a filter.
- The wiki is updated with architecture, API, and decisions pages.

## 10. Out of scope (YAGNI)

Persistence, auth, pagination, node-level query DSL, a UI, Docker, and query-time path search between arbitrary
nodes. These are listed in the README as possible extensions.
