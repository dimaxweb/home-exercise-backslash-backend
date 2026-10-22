# Graph Query Engine: Train Ticket

A small, deterministic REST service that loads the Train Ticket microservice graph (`data/train-ticket-be.json`),
normalizes its quirks, and serves render-ready graphs (vis-network shape `{ nodes, edges }`). It provides a risk-first
overview, on-demand node expansion, and route queries composed from **pluggable filters**. A React + vis-network UI
renders it.

**Who it's for (assumption):** an AppSec engineer at a Backslash customer. *"When the scanner flags vulnerabilities,
show me which ones are reachable and lead to sensitive data, so I fix those first."* The three built-in filters form
an attack path: **public entry → vulnerable service → sink**.

## Run

Requires Node 24. It's an Nx monorepo, and every script runs from the repo root.

```bash
npm install
npm run dev          # api on http://localhost:3000 + UI on http://localhost:4200 (open this one)
npm run verify       # lint + typecheck + tests + build, all projects
npm test             # unit + API + real-data smoke + UI tests
npm run build        # dist/apps/api and dist/apps/web
npm start            # built api only. Env: PORT (default 3000), GRAPH_FILE (default ./data/train-ticket-be.json)
```

Single projects: `npx nx serve api`, `npx nx serve web`, `npx nx test graph-engine`. `npx nx preview web` serves
the production UI build on :4300 with the same API proxy.

### Layout

| Project | Path | Tags | Contents |
|---|---|---|---|
| `api-contract` | `libs/api-contract` | `scope:shared`, `type:util` | response types and `as const` sets shared by api and web |
| `graph-engine` | `libs/graph-engine` | `scope:api`, `type:feature` | pure engine: load/normalize, routes, filters, query, views |
| `api` | `apps/api` | `scope:api`, `type:app` | thin Express layer + zod query validation |
| `web` | `apps/web` | `scope:web`, `type:app` | React 19 + vis-network UI, TanStack Query |

`@nx/enforce-module-boundaries` stops `web` from importing the engine or anything in `scope:api`. Both apps share
only `api-contract`, so a change to a response shape breaks the compile on both sides.

### UI

The UI opens on the risk overview. Fill colour shows severity, public entry points get a thick blue border, sinks are
drawn as databases, queues as diamonds, and inferred nodes with a dashed border. `+n` under a label counts the
node's edges that aren't on the canvas.

- Click a node to see its details and vulnerabilities, then expand its callers, callees or both. Double-click a node
  to expand both directions.
- In the filter bar, check filters, pick `all` or `any`, then **Show routes**. Click a route in the list to highlight
  it and zoom to it. **Overview** goes back to the start.
- **Flow** (left-to-right hierarchy) and **Force** switch the layout.

In dev, the UI calls `/api/*` and Vite proxies that to the api with the prefix stripped (`API_URL` overrides the
target).

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
curl "localhost:3000/routes?filters=starts-public,ends-in-sink,has-vulnerability"   # → 0 routes, see Findings
```

## Rendering with vis-network

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

Note: `hidden` is relative to the response that carried it. After several expansions a badge can overstate what is
still hidden. The bundled UI fixes this (D15). The first time it sees a node, it stores the node's total degree
(`hidden` + the response edges touching it). From then on the badge is that total minus the edges on the canvas. See
`apps/web/src/graph/vis-mapping.ts`.

## Adding a filter

Write a `RouteFilter` and `.register()` it in `defaultRegistry()` (`libs/graph-engine/src/filters/built-in.ts`).
The engine, API, validation, `GET /filters`, the `validFilters` error list and the UI filter bar all pick it up
without changes.

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

`matches(route, graph)` must be pure. `route` is an ordered list of node ids.

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

## Limitations / next steps

- No server-side clustering for very large graphs. The UI bundle is about 920 kB minified, mostly vis-network, and Vite
  warns about the chunk size.
- `hidden` counts in the API are per response. The bundled UI corrects for this; other clients must do the same (D15).
- `npm start` serves only the api. In production the UI build (`dist/apps/web`) needs a static host that proxies
  `/api`, like `nx preview web` does.
- The UI is tested with unit tests (mapping, degree tracking, API client, filter bar). Canvas interactions were
  checked by hand in a browser, not by an automated e2e suite.
- Enumeration starts only at in-degree-0 nodes, so a pure cycle with no entry node yields no routes.
- No pagination of `/routes`. Path counts can grow exponentially on dense graphs.
