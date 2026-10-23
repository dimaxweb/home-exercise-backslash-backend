# Graph Query Engine: Train Ticket

## 1. Who it's for (assumption)

The user is an AppSec engineer at a Backslash customer, not a developer browsing the architecture. Their job:
*"When the scanner flags vulnerabilities, show me which ones are reachable and lead to sensitive data, so I fix those
first."* The graph is evidence for a prioritization decision. That's why the three built-in filters form an attack
path, **public entry → vulnerable service → sink**, and it shapes the rest of the design:

- **Risk first.** The first screen shows vulnerable services, public entry points, sinks, and the routes between them,
  not the whole graph.
- **Expand on demand.** Everything else is one click away. The first screen is capped at 50 nodes and expansion
  loads one hop at a time, so the UI doesn't have to draw the whole graph. This dataset is small enough to draw
  whole, but real customer graphs can have thousands of services.
- **Empty results must be explainable.** On this data, the full attack-path query returns 0 routes, and that's a
  finding, not a bug (see [Data findings](#data-findings)).

## 2. What it is

A small, deterministic REST service that loads the Train Ticket microservice graph (`data/train-ticket-be.json`),
normalizes its quirks, and serves render-ready graphs (vis-network shape `{ nodes, edges }`). It provides a
risk-first overview, on-demand node expansion, and route queries composed from **pluggable filters**. A React +
vis-network UI renders it.

**Quick start:** `npm install && npm run dev`, then open http://localhost:4200. See [Run](#run) for details.

## 3. The overview

The UI opens on the risk overview: 25 of 47 nodes.

- **Fill color** shows severity: red for high, orange for medium.
- **Thick blue border:** public entry point.
- **Shapes:** sinks are databases, queues are diamonds, and nodes that are missing from the data but referenced by an
  edge have a dashed border.
- **`+n`** under a label is how many of the node's connections aren't drawn yet.

Clicking a node opens its details: kind, risk, and vulnerabilities with file, message and CWE. **Callers**,
**Callees** and **Both** (or a double-click) pull in its neighbors, and the `+n` drops. Expansion is stateless: the
server returns one hop, and the client merges it by id.

## 4. Filtering routes

A **route** is a complete call flow: a path from an entry service (nothing calls it) to a terminal one (it calls
nothing).

1. In the filter bar, check filters, pick `all` (AND) or `any` (OR), then click **Show routes**.
2. The route list shows the matches. Clicking a route highlights it and zooms to it.

| Query | Result |
|---|---|
| `has-vulnerability` AND `ends-in-sink` | 30 of 222 routes |
| `starts-public` AND `has-vulnerability` AND `ends-in-sink` | **0 routes.** The public `frontend` reaches neither vulnerable service, and the public `gateway-service` has no edges at all |

### Adding a filter

Adding a filter means writing one object and registering it, both in one file
(`libs/graph-engine/src/filters/built-in.ts`). The engine, API, validation, `GET /filters`, the `validFilters` error
list and the UI filter bar all pick it up without changes.

```ts
const longRoute: RouteFilter = {
  name: 'long-route',
  description: 'Route has at least 3 nodes',
  matches: (route) => route.length >= 3,
};

export function defaultRegistry(): FilterRegistry {
  return new FilterRegistry().register(startsPublic).register(endsInSink).register(hasVulnerability).register(longRoute);
}
```

`matches(route, graph)` must be pure, and `route` is an ordered list of node ids. Nothing downstream knows any filter
by name:
- The engine runs `filters.every(...)` for `all` or `filters.some(...)` for `any`.
- The API resolves names through the registry. An unknown name returns a 400 that lists the valid filters.
- The UI builds its checkboxes from `GET /filters`.

`libs/graph-engine/test/filters/registry.test.ts` registers this custom filter, so the extension path itself is tested.

## 5. Architecture

It's an Nx monorepo. The engine is pure functions; only the api app does I/O.

| Project | Path | Tags | Contents |
|---|---|---|---|
| `api-contract` | `libs/api-contract` | `scope:shared`, `type:util` | response types and `as const` sets shared by api and web |
| `graph-engine` | `libs/graph-engine` | `scope:api`, `type:feature` | pure engine: load/normalize, routes, filters, query, views |
| `api` | `apps/api` | `scope:api`, `type:app` | thin Express layer + zod query validation |
| `web` | `apps/web` | `scope:web`, `type:app` | React 19 + vis-network UI, TanStack Query |

- **Boundaries:** `@nx/enforce-module-boundaries` stops `web` from importing the engine or anything in `scope:api`.
  Both apps share only `api-contract`, so a change to a response shape breaks the compile on both sides.
- **Flow:** load + normalize → enumerate routes (once, at startup) → filter → shape the view → JSON.
- **Normalization at load time:**
  - zod validates the raw JSON.
  - A `to` given as a single string is wrapped in an array.
  - The undeclared `assurance-service` is added as an inferred node.
  - Defaults are filled in and duplicate edges are removed.
  - Quirks never reach the engine.

## 6. Quality

`npm run verify` runs lint, typecheck, tests and build for all four projects. There are 61 tests:
- **Engine (30):** unit tests on a small hand-built fixture.
- **API (22):** supertest tests, plus a smoke test against the real data. Its expected numbers were computed
  independently from the raw JSON: 47 nodes, 98 edges, 222 routes; filter counts 6 / 30 / 60 / 0; an overview of 25
  nodes and 42 edges.
- **UI (9):** vis mapping, hidden-edge tracking, the API client and the filter bar.

## 7. Limitations / next steps

- **Silent route loss.** A cycle with no way in, or a self-loop on an entry node, drops routes without a warning.
  Load-time validation for these is the first next step.
- **Scale.**
  - The server enumerates every route at startup, and `/routes` isn't paginated. Path counts can grow
    exponentially on dense graphs.
  - There's no server-side clustering.
  - The UI bundle is about 920 kB minified, mostly vis-network.
- **`hidden` is per response.** The API's `hidden` counts only describe the response they come in. The bundled UI
  corrects for this (D15); other clients must do the same.
- **Production hosting.** `npm start` serves only the api. The UI build needs a static host that proxies `/api`, the
  way `nx preview web` does.
- **No end-to-end tests.** Canvas interactions were checked by hand in a browser, not by an automated end-to-end
  suite.

---

# Reference

## Run

Requires Node 24. Every script runs from the repo root.

```bash
npm install
npm run dev          # api on http://localhost:3000 + UI on http://localhost:4200 (open this one)
npm run verify       # lint + typecheck + tests + build, all projects
npm test             # unit + API + real-data smoke + UI tests
npm run build        # dist/apps/api and dist/apps/web
npm start            # built api only. Env: PORT (default 3000), GRAPH_FILE (default ./data/train-ticket-be.json)
```

Single projects: `npx nx serve api`, `npx nx serve web`, `npx nx test graph-engine`. `npx nx preview web` serves
the production UI build on :4300 with the same API proxy. In dev, the UI calls `/api/*` and Vite proxies that to
the api with the prefix stripped (`API_URL` overrides the target).

On startup the server logs any load warnings and the graph size:

```
[load-graph] Node "assurance-service" is referenced by an edge but not declared; synthesized as an inferred service
Graph query engine on http://localhost:3000 (47 nodes, 98 edges, 222 routes)
```

## API

| Method & path | Response |
|---|---|
| `GET /health` | `{ status: "ok" }` |
| `GET /graph/overview?maxNodes=50` | `GraphView & { meta: { totalNodes, shownNodes, truncated } }`, the first screen |
| `GET /nodes/:id/neighbors?direction=in\|out\|both` | `GraphView`, one-hop expansion. Unknown id → 404 |
| `GET /graph` | `GraphView` of the full graph (small graphs / debugging) |
| `GET /filters` | `[{ name, description }]` |
| `GET /routes?filters=a,b&match=all\|any` | `GraphView & { routes: { id, nodes }[], meta: { filters, match, totalRoutes, matchedRoutes } }` |

`GraphView = { nodes: ViewNode[], edges: { id, from, to }[] }`. Each `ViewNode` is the normalized node plus
`label`, `group` (= kind), `risk: { public, vulnerable, maxSeverity, sink }` and `hidden: { in, out }`. `hidden`
counts the node's edges that are *not* in this response.

`filters` also accepts the repeated form (`?filters=a&filters=b`). `match` defaults to `all` (AND).

Errors: an unknown filter returns `400 { error, validFilters }`. A bad `match`/`direction` or a `maxNodes` outside
1–500 returns `400 { error }`. An unknown node or path returns `404 { error }`.

```bash
curl localhost:3000/graph/overview
curl "localhost:3000/nodes/order-service/neighbors?direction=in"
curl "localhost:3000/routes?filters=has-vulnerability,ends-in-sink"
curl "localhost:3000/routes?filters=starts-public,ends-in-sink,has-vulnerability"   # → 0 routes, see Data findings
```

## Rendering with vis-network

For a client other than the bundled UI:

```js
const nodes = new vis.DataSet();
const edges = new vis.DataSet();
const network = new vis.Network(container, { nodes, edges }, { edges: { arrows: 'to' } });
const badge = (n) => (n.hidden.in + n.hidden.out > 0 ? `${n.label} (+${n.hidden.in + n.hidden.out})` : n.label);
const merge = (view) => {
  nodes.update(view.nodes.map((n) => ({ ...n, label: badge(n) })));
  edges.update(view.edges);
};
fetch('/graph/overview').then((r) => r.json()).then(merge);
network.on('doubleClick', ({ nodes: [id] }) =>
  id && fetch(`/nodes/${encodeURIComponent(id)}/neighbors`).then((r) => r.json()).then(merge));
```

Note: `hidden` is relative to the response that carried it, so after several expansions a badge can overstate what
is still hidden. The bundled UI fixes this (D15):
- The first time it sees a node, it stores the node's total degree (`hidden` + the response edges touching it).
- From then on the badge is that total minus the edges on the canvas.

See `apps/web/src/graph/vis-mapping.ts`.

## Decisions

See the [design spec §3](docs/superpowers/specs/2026-10-22-graph-query-engine-design.md#3-decisions-approved-2026-10-22).

| # | Decision |
|---|---|
| D1 | Node + TypeScript (strict), Express, zod, Jest + ts-jest + supertest |
| D2 | Sink = `kind ∈ { rds }`. `sqs` is a queue, not a sink |
| D3 | Filters combine with `match=all` (AND, default) or `match=any` (OR) |
| D4 | A dangling edge target is synthesized as `{ kind: service, inferred: true }` and logged as a warning |
| D5 | Route = maximal path from an entry node (in-degree 0) to a terminal node (out-degree 0). An isolated node is a 1-node route |
| D6 | Cycle guard: the walk skips nodes already on the current path, so a cycle ends the route |
| D7 | In memory: graph and routes are computed once at startup |
| D8 | vis-network contract: nodes `{ id, label, group }`, edges `{ id, from, to }`, extra fields pass through |
| D9 | Progressive loading is stateless: overview + per-node expansion, and the client merges by id |
| D10 | Overview priority: vulnerable (by severity) → public entry → sink. Decides what survives `maxNodes` |
| D11 | Nx integrated monorepo: `apps/api`, `apps/web`, `libs/graph-engine`, `libs/api-contract`, with enforced module boundaries |
| D12 | Backend stays Express + zod; no NestJS migration |
| D13 | UI: React 19 + vis-network (standalone) + TanStack Query. No router, no global store |
| D14 | The UI calls `/api/*`; Vite proxies it to the api and strips the prefix |
| D15 | The client stores each node's total degree, so `+n` stays correct across expansions |

D11–D15 are in the [spec addendum §12](docs/superpowers/specs/2026-10-22-graph-query-engine-design.md#12-addendum-2026-10-22-nx-monorepo--vis-network-ui).

## Data findings

- **`to` is sometimes a string** (`consign-service → "consign-price-service"`). It is normalized to an array at load.
- **Dangling `assurance-service`**: it is the target of edges from `preserve-service` and `preserve-other-service`
  but has no node entry. It is synthesized as an inferred service (46 declared nodes → 47).
- **CWE/message mismatch on `auth-service`**: the message describes SQL injection, but `metadata.cwe` says CWE-22
  Path Traversal. It is passed through as-is.
- **Both vulnerable services (`auth-service` medium, `order-service` high) reach `prod-postgresdb`**: 60 routes
  pass through a vulnerable node and 30 routes end in a sink.
- **The full attack-path AND returns 0 routes.** The public `frontend` reaches neither vulnerable service, and the
  public `gateway-service` has **no edges at all**, which is probably missing data. On this data, nothing reachable
  from the internet leads through a known vulnerability to the database. A missing gateway edge could change that.
