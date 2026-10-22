# Graph Query Engine — Design Spec

Date: 2026-10-22 · Status: approved · Budget: ~1 hour total

## 1. Goal

Load `data/train-ticket-be.json` (Train Ticket microservice graph) and expose a REST API, consumed by a
**vis-network** (canvas) UI, that:

- returns a **risk-first overview** that fits on screen, plus **on-demand expansion** of any node's neighbors;
- filters **routes** using composable, pluggable filters. The three built-in filters are: starts in a public service,
  ends in a sink, and has a vulnerable node.

Adding a filter = write one `RouteFilter` object + register it. No changes to the engine, the API, or the validation.

## 2. User and job to be done (assumption)

**Persona:** an AppSec engineer at a Backslash customer, not a developer browsing the architecture.

**Job:** *"When the scanner flags vulnerabilities, show me which ones are reachable and lead to sensitive data, so I
fix those first."* The graph is evidence for a prioritization decision. The built-in filters line up as an attack
path: **public entry → vulnerable service → sink**.

Consequences for the API:

- The first screen shows risk (vulnerable nodes, their routes, entry points, sinks), not the whole graph.
- Everything else is reachable by expanding nodes. The UI never needs the full graph at once.
- Empty results are meaningful and must be explainable (see §8: the full attack-path AND is empty on this data).

The Train Ticket graph is small (47 nodes after normalization, 98 edges), and vis-network renders it whole. The
progressive design targets real customer graphs (thousands of services). For this dataset it costs only two small
endpoints.

## 3. Decisions (approved 2026-10-22)

| # | Decision | Choice |
|---|---|---|
| D1 | Stack | Node + TypeScript (strict), Express, zod (input/data validation), Jest + ts-jest + supertest |
| D2 | Sink | `kind ∈ SINK_KINDS = { rds }`. `sqs` is a queue, not a sink. Extending the set is a one-line change |
| D3 | Combining filters | `match=all` (AND, default) or `match=any` (OR) |
| D4 | Dangling edge target (`assurance-service`) | Synthesize `{ id, kind: service, inferred: true }`, log a warning |
| D5 | Definition of a route | A **maximal path**: from an entry node (in-degree 0) to a terminal node (out-degree 0), following edge direction. An isolated node is a 1-node route |
| D6 | Cycles | Data is acyclic, but enumeration tracks the nodes on the current path and stops instead of looping. A cycle-truncated route ends at the last node before the repeat |
| D7 | Storage | In-memory. Graph and routes are computed once at startup (222 routes; cheap) |
| D8 | Renderer contract | vis-network shape: nodes `{ id, label, group }`, edges `{ id, from, to }`. Extra fields pass through untouched |
| D9 | Progressive loading | Stateless: overview + per-node neighbor expansion. The client merges by id (vis `DataSet.update`). The server keeps no record of what a client has |
| D10 | Overview priority | Vulnerable first (by max severity), then public entry, then sink. Decides what survives the `maxNodes` cap |

Rationale for D5: maximal paths are "complete call flows". Enumerating every sub-path (440 here) duplicates prefixes and
adds noise for a renderer. Trade-off: a filter like "ends in sink" only sees routes that start at an entry point. That is
acceptable because every sink is reachable from some entry point.

## 4. Data normalization (load time)

Raw quirks (see `wiki/pages/domain/graph-data.md`):

1. `edge.to` may be a string → wrap it in an array.
2. Edge targets/sources missing from `nodes` → synthesized node (D4).
3. Optional `publicExposed` → `false`, `vulnerabilities` → `[]`.
4. Duplicate edges are deduplicated.

Raw JSON is validated with a zod schema. If it is invalid, startup fails fast with a clear error.

## 5. Domain model

```ts
const NodeKind = { Service: 'service', Rds: 'rds', Sqs: 'sqs' } as const;   // unknown kinds pass through as string
const Severity = { Low: 'low', Medium: 'medium', High: 'high', Critical: 'critical' } as const;
interface Vulnerability { file: string; severity: string; message: string; metadata?: Record<string, unknown> }
interface GraphNode {
  id: string; kind: string; language?: string; path?: string;
  publicExposed: boolean; vulnerabilities: Vulnerability[];
  metadata?: Record<string, unknown>; inferred?: boolean;
}
interface GraphEdge { id: string /* `${from}->${to}` */; from: string; to: string }
interface Graph { nodes: Map<string, GraphNode>; edges: GraphEdge[]; out: Map<string, string[]>; in: Map<string, string[]> }
type Route = string[];                     // ordered node ids
```

### View model (what the API returns)

```ts
interface ViewNode extends GraphNode {
  label: string;                           // = id
  group: string;                           // = kind (vis styling hook)
  risk: { public: boolean; vulnerable: boolean; maxSeverity: string | null; sink: boolean };
  hidden: { in: number; out: number };     // edges of this node NOT in this response → UI shows an "expand (+n)" badge
}
interface GraphView { nodes: ViewNode[]; edges: GraphEdge[] }
```

`hidden` is relative to the response it appears in. It is computed by one pure function:
`toView(graph, nodeIds, edges): GraphView`. Edge endpoints are always included. Every endpoint goes through it.

## 6. Filter mechanism (the extensibility point)

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

## 7. Overview and expansion (pure, `src/view/`)

### `buildOverview(graph, routes, maxNodes): GraphView & { truncated: boolean }`

1. **Seeds**, in D10 priority: vulnerable nodes (severity rank desc), public nodes, sink nodes. Ties are broken by id.
   Take seeds in order until `maxNodes` is reached.
2. **Risk routes** = routes that pass the `has-vulnerability` filter, ranked by: max severity on the route desc,
   starts public, ends in sink, then route id asc. The ranking is deterministic.
3. Add each risk route in rank order if its new nodes still fit under `maxNodes`. Otherwise skip it and set
   `truncated = true`.
4. Edges = the edges along the included routes. Seeds without included routes appear without edges.
5. `toView(...)` adds `hidden` counts.

Default `maxNodes = 50`. Valid range: 1–500. On this data the overview has 25 of 47 nodes and 42 edges, from 60 of 222 routes,
with `truncated: false`.

### `expandNode(graph, id, direction): GraphView`

Returns the node and its direct neighbors (`in`, `out`, or `both`, default `both`), plus the connecting edges, with
`hidden` counts. The client merges the result into its DataSets, so nodes that are already shown are harmless.

## 8. REST API

| Method & path | Response |
|---|---|
| `GET /health` | `{ status: "ok" }` |
| `GET /graph/overview?maxNodes=50` | `GraphView & { meta: { totalNodes, shownNodes, truncated } }` — first screen |
| `GET /nodes/:id/neighbors?direction=in\|out\|both` | `GraphView` — expansion. Unknown id → 404 |
| `GET /graph` | `GraphView`, the full graph (small graphs / debugging) |
| `GET /filters` | `[{ name, description }]`, for client discoverability |
| `GET /routes?filters=a,b&match=all\|any` | `RoutesResponse` below |

```ts
interface RoutesResponse extends GraphView {   // union of nodes/edges on matched routes, with hidden counts
  routes: { id: string; nodes: string[] }[];   // id = nodes.join('>'); UI can highlight one route
  meta: { filters: string[]; match: 'all' | 'any'; totalRoutes: number; matchedRoutes: number };
}
```

`filters` also accepts the repeated form (`?filters=a&filters=b`).

Errors: an unknown filter, an invalid `match`/`direction`, or an out-of-range `maxNodes` returns `400 { error }`. For
unknown filters, the 400 body also includes `validFilters`. An unknown node returns `404 { error }`. An unknown path
returns `404 { error }`.

Expected results on the real data: `starts-public` → 6 routes, `ends-in-sink` → 30, `has-vulnerability` → 60, all
three ANDed → 0. Both vulnerable services reach `prod-postgresdb`, but the public `frontend` reaches neither of them,
and the public `gateway-service` has no edges (probably missing data). README documents this as a finding.

## 9. Module layout

```
src/
  graph/types.ts         # NodeKind, Severity, SINK_KINDS, interfaces
  graph/load-graph.ts    # zod raw schema + normalize → Graph
  graph/routes.ts        # enumerateRoutes(graph): Route[]
  filters/types.ts       # RouteFilter
  filters/registry.ts    # FilterRegistry
  filters/built-in.ts    # the 3 built-in filters + defaultRegistry()
  query/query-routes.ts  # queryRoutes (pure)
  view/to-view.ts        # toView: ViewNode (label/group/risk/hidden) + edges
  view/overview.ts       # buildOverview
  view/expand.ts         # expandNode
  api/app.ts             # createApp({ graph, routes, registry }): express.Application
  main.ts                # load file, build app, listen on PORT (default 3000)
```

Everything except `api/` and `main.ts` is pure and has no I/O.

## 10. Testing (TDD)

- Unit, on small hand-built fixtures: normalization (string `to`, dangling target, defaults, dedup); route enumeration
  (branching, isolated node, cycle guard); each built-in filter; `all` vs `any`; `toView` (risk flags, `hidden`
  counts, no duplicate edges); overview (seed priority, route ranking, cap → `truncated`); expand (each direction).
- API (supertest): each endpoint, the comma and repeated filter forms, 400 for an unknown filter, bad `match`, bad
  `direction`, bad `maxNodes`, and 404 for an unknown node.
- One smoke test against the real JSON with the counts from §7–8.

## 11. Deliverables

- `README.md`: how to run, the persona/JTBD, API examples (including a vis-network snippet), decisions D1–D10, the
  data findings, and how to add a filter.
- The wiki is updated with architecture, API, and decisions pages.

## 12. Addendum (2026-10-22): Nx monorepo + vis-network UI

Requested after G1–G6. The design above is unchanged. This section adds packaging and a client.

| # | Decision | Choice |
|---|---|---|
| D11 | Repo layout | Nx integrated monorepo. `apps/api` (Express, thin), `apps/web` (React + Vite), `libs/graph-engine` (all the pure code from §9, `scope:api`), `libs/api-contract` (response types + `as const` sets shared by api and web, `scope:shared`). Boundaries are enforced by `@nx/enforce-module-boundaries` |
| D12 | Backend framework | Stays Express + zod (D1). No NestJS migration, because it is out of budget and adds no behavior |
| D13 | UI | React 19 + `vis-network` (standalone build, DataSet merge by id). TanStack Query for server state. No routing, no global store |
| D14 | Dev wiring | The web app calls `/api/*`. Vite proxies `/api` to `localhost:3000` and strips the prefix, so the API URLs don't change. `npm run dev` serves both |
| D15 | `hidden` on the client | The client stores each node's total degree (`hidden` + edges touching it in the response, captured the first time the node is seen). The badge is `total − edges in the DataSet`, which fixes the per-response staleness noted in §5 |

UI behavior: it loads `/graph/overview` on start. Node style comes from `risk`: vulnerable nodes are filled by
severity, public nodes get a thick border, sinks use the `database` shape, inferred nodes are dashed. Clicking a node
opens a details panel (kind, risk, vulnerabilities, Expand in/out/both). Double-clicking expands both directions. A
filter bar lists `/filters` as checkboxes with an all/any toggle and replaces the canvas with the `/routes` result.
The route list highlights one route on click. "Reset" returns to the overview.

## 13. Out of scope (YAGNI)

Server-side clustering, sessions or "already sent" tracking, persistence, auth, pagination of routes,
a node-level query DSL, Docker, and query-time path search between arbitrary nodes. These are listed in the README as
possible extensions.
