# Graph Query Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Node/TypeScript REST service that loads the Train Ticket graph and serves a risk-first overview, node
expansion, and pluggable route filtering, all in the shape vis-network expects.

**Architecture:** Pure functions do everything: load and normalize → enumerate routes → filter → build views. The Express
layer is thin: validate the query with zod, call one pure function, return JSON. Graph and routes are computed once at
startup and kept in memory.

**Tech Stack:** Node 24, TypeScript 5 (strict), Express 4, zod 3, Jest 29 + ts-jest, supertest.

**Spec:** `docs/superpowers/specs/2026-10-22-graph-query-engine-design.md`. Read §5–§8 before starting.

---

## How this plan is organized: goals

The plan has 6 **goals**. Each goal is a milestone with a **Done when** condition that a command can check. Do not
start a goal until the previous goal's condition holds. Each goal ends with a commit and a wiki update
(`wiki/CLAUDE.md` → "Task completion").

| Goal | Delivers | Done when |
|---|---|---|
| G1 | Toolchain | `npm run verify` exits 0 |
| G2 | Graph core: load, normalize, routes | G2 unit tests are green |
| G3 | Pluggable filters + query | G3 unit tests are green, and a new filter needs no engine change |
| G4 | Render views: toView, overview, expand | G4 unit tests are green |
| G5 | HTTP API + server | API tests are green, `npm start` serves `/graph/overview` |
| G6 | Real-data verification + README + wiki | Smoke test is green with the spec's numbers, docs are written |

`npm run verify` = typecheck + all tests + build. Run it at the end of every goal.

## File map

```
package.json, tsconfig.json, tsconfig.build.json, jest.config.js
src/
  graph/types.ts         # NodeKind, Severity, SINK_KINDS, severityRank, interfaces, edgeId, routeId
  graph/node-risk.ts     # isSink, isVulnerable, maxSeverity
  graph/load-graph.ts    # zod raw schema + normalize → { graph, warnings }
  graph/routes.ts        # enumerateRoutes, routeEdges
  filters/types.ts       # RouteFilter
  filters/registry.ts    # FilterRegistry
  filters/built-in.ts    # FilterName, 3 built-ins, defaultRegistry()
  query/query-routes.ts  # MatchMode, queryRoutes
  view/to-view.ts        # ViewNode, GraphView, toView, viewOfRoutes
  view/overview.ts       # DEFAULT_MAX_NODES, MAX_NODES_LIMIT, buildOverview
  view/expand.ts         # Direction, expandNode
  api/query-schemas.ts   # zod schemas for query strings
  api/app.ts             # createApp(deps)
  engine.ts              # createEngine(raw): AppDeps + warnings (shared by main and smoke test)
  main.ts                # read file, listen
test/
  fixtures.ts            # small hand-built graph used by every unit test
  graph/load-graph.test.ts, graph/routes.test.ts
  filters/registry.test.ts, filters/built-in.test.ts, query/query-routes.test.ts
  view/to-view.test.ts, view/overview.test.ts, view/expand.test.ts
  api/app.test.ts
  smoke.test.ts          # real data
```

### The fixture (memorize it, every test uses it)

```
web (public) ──► api (vuln: high) ──► db (rds = sink)
     └────────► worker ─────────────► queue (sqs, NOT a sink)
lonely (isolated)
```

Routes: `web>api>db`, `web>worker>queue`, `lonely`. Nodes 6, edges 4.

---

## Goal G1: Toolchain

**Done when:** `npm run verify` exits 0, with no tests yet (`--passWithNoTests`).

### Task 1.1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `jest.config.js`
- Check: `.gitignore` (it already contains `node_modules/`, `dist/`, `coverage/`)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "graph-query-engine",
  "version": "1.0.0",
  "private": true,
  "description": "Graph query engine for the Train Ticket microservice graph",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "test": "jest --passWithNoTests",
    "start": "node dist/main.js",
    "verify": "npm run typecheck && npm test && npm run build"
  }
}
```

- [ ] **Step 2: Install dependencies (pinned versions)**

Purpose of each package:
- `express`: HTTP routing.
- `zod`: validates the raw JSON at load time and the query strings per request.
- `typescript`, `@types/*`: strict typing.
- `jest`, `ts-jest`: the test runner, running TS directly.
- `supertest`: in-process HTTP tests, so no port is opened.

Run:
```bash
npm i -E express@4.21.2 zod@3.23.8
npm i -D -E typescript@5.6.3 jest@29.7.0 ts-jest@29.2.5 @types/jest@29.5.14 supertest@7.0.0 @types/supertest@6.0.2 @types/express@4.17.21 @types/node@22.10.2
```
Expected: `added N packages`, no errors.

- [ ] **Step 3: Create `tsconfig.json`** (typecheck for src + test, no emit)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node", "jest"],
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Create `tsconfig.build.json`** (emits `src` only)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "outDir": "dist", "rootDir": "src", "types": ["node"] },
  "include": ["src"]
}
```

- [ ] **Step 5: Create `jest.config.js`**

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
};
```

- [ ] **Step 6: Add a placeholder so `tsc` has an input**

Create `src/main.ts` with only `export {};`. Task 5.3 replaces it.

- [ ] **Step 7: Verify**

Run: `npm run verify`
Expected: typecheck passes, jest prints "No tests found, exiting with code 0", and the build creates `dist/main.js`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.build.json jest.config.js src/main.ts
git commit -m "chore: TypeScript, Jest and Express toolchain"
```

---

## Goal G2: Graph core

**Done when:** `npx jest test/graph` is green, and `npm run verify` exits 0.

### Task 2.1: Domain types and node risk helpers

**Files:**
- Create: `src/graph/types.ts`, `src/graph/node-risk.ts`

These are types and one-liners. They get tested through the filters and views in G3 and G4.

- [ ] **Step 1: Create `src/graph/types.ts`**

```ts
export const NodeKind = { Service: 'service', Rds: 'rds', Sqs: 'sqs' } as const;

/** Kinds that count as a data sink. `sqs` is a queue, not a sink (decision D2). */
export const SINK_KINDS: ReadonlySet<string> = new Set<string>([NodeKind.Rds]);

export const Severity = { Low: 'low', Medium: 'medium', High: 'high', Critical: 'critical' } as const;

const SEVERITY_RANK: Readonly<Record<string, number>> = {
  [Severity.Low]: 1,
  [Severity.Medium]: 2,
  [Severity.High]: 3,
  [Severity.Critical]: 4,
};

/** Higher = worse. Unknown or missing severity ranks 0. */
export function severityRank(severity: string | null): number {
  return severity === null ? 0 : (SEVERITY_RANK[severity.toLowerCase()] ?? 0);
}

export interface Vulnerability {
  file: string;
  severity: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  kind: string;
  language?: string;
  path?: string;
  publicExposed: boolean;
  vulnerabilities: Vulnerability[];
  metadata?: Record<string, unknown>;
  /** True when the node was referenced by an edge but missing from `nodes` (decision D4). */
  inferred?: boolean;
}

/** vis-network compatible edge (decision D8). */
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  out: Map<string, string[]>;
  in: Map<string, string[]>;
}

/** Ordered node ids, entry → terminal. */
export type Route = string[];

export const edgeId = (from: string, to: string): string => `${from}->${to}`;
export const routeId = (route: Route): string => route.join('>');
```

- [ ] **Step 2: Create `src/graph/node-risk.ts`**

```ts
import { GraphNode, SINK_KINDS, severityRank } from './types';

export const isSink = (node: GraphNode): boolean => SINK_KINDS.has(node.kind);

export const isVulnerable = (node: GraphNode): boolean => node.vulnerabilities.length > 0;

/** Worst severity on the node, lower-cased, or null when it has no vulnerabilities. */
export function maxSeverity(node: GraphNode): string | null {
  let worst: string | null = null;
  for (const v of node.vulnerabilities) {
    if (worst === null || severityRank(v.severity) > severityRank(worst)) worst = v.severity.toLowerCase();
  }
  return worst;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

### Task 2.2: Load and normalize

**Files:**
- Create: `test/fixtures.ts`, `test/graph/load-graph.test.ts`, `src/graph/load-graph.ts`

- [ ] **Step 1: Create `test/fixtures.ts`**

```ts
import { loadGraph } from '../src/graph/load-graph';
import { Graph } from '../src/graph/types';

export const rawFixture = {
  nodes: [
    { name: 'web', kind: 'service', publicExposed: true },
    { name: 'api', kind: 'service', vulnerabilities: [{ file: 'Api.java', severity: 'high', message: 'sqli' }] },
    { name: 'worker', kind: 'service' },
    { name: 'db', kind: 'rds' },
    { name: 'queue', kind: 'sqs' },
    { name: 'lonely', kind: 'service' },
  ],
  edges: [
    { from: 'web', to: ['api', 'worker'] },
    { from: 'api', to: 'db' },
    { from: 'worker', to: ['queue'] },
  ],
};

export const fixtureGraph = (): Graph => loadGraph(rawFixture).graph;
```

- [ ] **Step 2: Write the failing test `test/graph/load-graph.test.ts`**

```ts
import { loadGraph } from '../../src/graph/load-graph';
import { rawFixture } from '../fixtures';

describe('loadGraph', () => {
  it('wraps a string `to` into a single edge', () => {
    const { graph } = loadGraph(rawFixture);
    expect(graph.edges).toContainEqual({ id: 'api->db', from: 'api', to: 'db' });
    expect(graph.edges).toHaveLength(4);
  });

  it('defaults publicExposed to false and vulnerabilities to []', () => {
    const worker = loadGraph(rawFixture).graph.nodes.get('worker');
    expect(worker).toMatchObject({ id: 'worker', kind: 'service', publicExposed: false, vulnerabilities: [] });
  });

  it('synthesizes a dangling edge target as an inferred service and warns', () => {
    const { graph, warnings } = loadGraph({
      nodes: [{ name: 'a', kind: 'service' }],
      edges: [{ from: 'a', to: ['ghost'] }],
    });
    expect(graph.nodes.get('ghost')).toEqual({
      id: 'ghost', kind: 'service', publicExposed: false, vulnerabilities: [], inferred: true,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('ghost');
  });

  it('deduplicates edges', () => {
    const { graph } = loadGraph({
      nodes: [{ name: 'a', kind: 'service' }, { name: 'b', kind: 'service' }],
      edges: [{ from: 'a', to: ['b', 'b'] }, { from: 'a', to: 'b' }],
    });
    expect(graph.edges).toEqual([{ id: 'a->b', from: 'a', to: 'b' }]);
  });

  it('builds out/in adjacency for every node', () => {
    const { graph } = loadGraph(rawFixture);
    expect(graph.out.get('web')).toEqual(['api', 'worker']);
    expect(graph.in.get('db')).toEqual(['api']);
    expect(graph.out.get('lonely')).toEqual([]);
    expect(graph.in.get('lonely')).toEqual([]);
  });

  it('fails fast on invalid input', () => {
    expect(() => loadGraph({ nodes: 'nope', edges: [] })).toThrow(/Invalid graph data/);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx jest test/graph/load-graph.test.ts`
Expected: FAIL, "Cannot find module '../../src/graph/load-graph'".

- [ ] **Step 4: Implement `src/graph/load-graph.ts`**

```ts
import { z } from 'zod';
import { Graph, GraphEdge, GraphNode, NodeKind, edgeId } from './types';

const RawVulnerability = z.object({
  file: z.string(),
  severity: z.string(),
  message: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

const RawNode = z.object({
  name: z.string().min(1),
  kind: z.string().min(1),
  language: z.string().optional(),
  path: z.string().optional(),
  publicExposed: z.boolean().optional(),
  vulnerabilities: z.array(RawVulnerability).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const RawEdge = z.object({
  from: z.string().min(1),
  to: z.union([z.string().min(1), z.array(z.string().min(1))]),
});

const RawGraphSchema = z.object({ nodes: z.array(RawNode), edges: z.array(RawEdge) });

export interface LoadResult {
  graph: Graph;
  warnings: string[];
}

/** Validates raw JSON and normalizes its quirks (spec §4) into a Graph. Pure: warnings are returned, not logged. */
export function loadGraph(raw: unknown): LoadResult {
  const parsed = RawGraphSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Invalid graph data: ${parsed.error.message}`);

  const warnings: string[] = [];
  const nodes = new Map<string, GraphNode>();
  for (const n of parsed.data.nodes) {
    if (nodes.has(n.name)) {
      warnings.push(`Duplicate node "${n.name}" ignored`);
      continue;
    }
    nodes.set(n.name, {
      id: n.name,
      kind: n.kind,
      language: n.language,
      path: n.path,
      publicExposed: n.publicExposed ?? false,
      vulnerabilities: n.vulnerabilities ?? [],
      metadata: n.metadata,
    });
  }

  const ensureNode = (id: string): void => {
    if (nodes.has(id)) return;
    nodes.set(id, { id, kind: NodeKind.Service, publicExposed: false, vulnerabilities: [], inferred: true });
    warnings.push(`Node "${id}" is referenced by an edge but not declared; synthesized as an inferred service`);
  };

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const e of parsed.data.edges) {
    const targets = Array.isArray(e.to) ? e.to : [e.to];
    for (const to of targets) {
      const id = edgeId(e.from, to);
      if (seen.has(id)) continue;
      seen.add(id);
      ensureNode(e.from);
      ensureNode(to);
      edges.push({ id, from: e.from, to });
    }
  }

  const out = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const id of nodes.keys()) {
    out.set(id, []);
    incoming.set(id, []);
  }
  for (const e of edges) {
    out.get(e.from)?.push(e.to);
    incoming.get(e.to)?.push(e.from);
  }

  return { graph: { nodes, edges, out, in: incoming }, warnings };
}
```

Note: the `toEqual` for `ghost` passes because Jest's `toEqual` ignores `undefined` properties. Declared nodes carry
`language: undefined` and so on. `JSON.stringify` drops those, so the API output stays clean.

- [ ] **Step 5: Run the test to see it pass**

Run: `npx jest test/graph/load-graph.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/graph test/fixtures.ts test/graph/load-graph.test.ts
git commit -m "feat: load and normalize graph data"
```

### Task 2.3: Route enumeration

**Files:**
- Create: `test/graph/routes.test.ts`, `src/graph/routes.ts`

- [ ] **Step 1: Write the failing test `test/graph/routes.test.ts`**

```ts
import { loadGraph } from '../../src/graph/load-graph';
import { enumerateRoutes, routeEdges } from '../../src/graph/routes';
import { fixtureGraph } from '../fixtures';

describe('enumerateRoutes', () => {
  it('returns maximal entry→terminal paths, isolated nodes as 1-node routes', () => {
    expect(enumerateRoutes(fixtureGraph())).toEqual([
      ['web', 'api', 'db'],
      ['web', 'worker', 'queue'],
      ['lonely'],
    ]);
  });

  it('stops at a cycle instead of looping', () => {
    const { graph } = loadGraph({
      nodes: [{ name: 's', kind: 'service' }, { name: 'a', kind: 'service' }, { name: 'b', kind: 'service' }],
      edges: [{ from: 's', to: 'a' }, { from: 'a', to: 'b' }, { from: 'b', to: 'a' }],
    });
    expect(enumerateRoutes(graph)).toEqual([['s', 'a', 'b']]);
  });
});

describe('routeEdges', () => {
  it('returns the consecutive edges of a route', () => {
    expect(routeEdges(['a', 'b', 'c'])).toEqual([
      { id: 'a->b', from: 'a', to: 'b' },
      { id: 'b->c', from: 'b', to: 'c' },
    ]);
    expect(routeEdges(['solo'])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest test/graph/routes.test.ts`
Expected: FAIL, "Cannot find module '../../src/graph/routes'".

- [ ] **Step 3: Implement `src/graph/routes.ts`**

```ts
import { Graph, GraphEdge, Route, edgeId } from './types';

/**
 * All maximal paths from an entry node (in-degree 0) to a terminal node (decision D5).
 * Nodes already on the current path are skipped, so a cycle ends the route (decision D6).
 */
export function enumerateRoutes(graph: Graph): Route[] {
  const routes: Route[] = [];
  const path: Route = [];
  const onPath = new Set<string>();

  const walk = (id: string): void => {
    path.push(id);
    onPath.add(id);
    const next = (graph.out.get(id) ?? []).filter((n) => !onPath.has(n));
    if (next.length === 0) routes.push([...path]);
    for (const n of next) walk(n);
    path.pop();
    onPath.delete(id);
  };

  for (const id of graph.nodes.keys()) {
    if ((graph.in.get(id) ?? []).length === 0) walk(id);
  }
  return routes;
}

export function routeEdges(route: Route): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (let i = 1; i < route.length; i++) {
    edges.push({ id: edgeId(route[i - 1], route[i]), from: route[i - 1], to: route[i] });
  }
  return edges;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx jest test/graph`
Expected: PASS, 9 tests.

- [ ] **Step 5: Verify the goal, update the wiki, commit**

Run: `npm run verify` and expect exit 0.

Wiki: create `wiki/pages/architecture/overview.md` with frontmatter (`category: architecture`). It covers the module
layout from this plan's file map and the flow: load → routes → filters → views → API. Add it to `wiki/index.md` under
Architecture, replacing the "pages to be filled" note. Append to `wiki/log.md`: `## [2026-10-22] update | G2 graph core`.

```bash
git add src/graph/routes.ts test/graph/routes.test.ts wiki
git commit -m "feat: enumerate maximal routes with cycle guard"
```

---

## Goal G3: Pluggable filters + query

**Done when:** `npx jest test/filters test/query` is green, and `npm run verify` exits 0. Adding a filter only means
creating a `RouteFilter` and calling `registry.register(...)`. The registry test shows this with a custom filter.

### Task 3.1: Filter contract and registry

**Files:**
- Create: `src/filters/types.ts`, `src/filters/registry.ts`, `test/filters/registry.test.ts`

- [ ] **Step 1: Create `src/filters/types.ts`**

```ts
import { Graph, Route } from '../graph/types';

/** The extensibility point: implement this and register it. Nothing else changes. */
export interface RouteFilter {
  /** kebab-case, used in `?filters=` */
  name: string;
  description: string;
  /** Must be pure. */
  matches(route: Route, graph: Graph): boolean;
}
```

- [ ] **Step 2: Write the failing test `test/filters/registry.test.ts`**

```ts
import { FilterRegistry } from '../../src/filters/registry';
import { RouteFilter } from '../../src/filters/types';

const longRoute: RouteFilter = {
  name: 'long-route',
  description: 'Route has at least 3 nodes',
  matches: (route) => route.length >= 3,
};

describe('FilterRegistry', () => {
  it('registers and looks up a custom filter', () => {
    const registry = new FilterRegistry().register(longRoute);
    expect(registry.get('long-route')).toBe(longRoute);
    expect(registry.names()).toEqual(['long-route']);
    expect(registry.list()).toEqual([longRoute]);
  });

  it('returns undefined for an unknown filter', () => {
    expect(new FilterRegistry().get('nope')).toBeUndefined();
  });

  it('rejects a duplicate name', () => {
    const registry = new FilterRegistry().register(longRoute);
    expect(() => registry.register(longRoute)).toThrow(/already registered/);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx jest test/filters/registry.test.ts`
Expected: FAIL, "Cannot find module '../../src/filters/registry'".

- [ ] **Step 4: Implement `src/filters/registry.ts`**

```ts
import { RouteFilter } from './types';

export class FilterRegistry {
  private readonly filters = new Map<string, RouteFilter>();

  register(filter: RouteFilter): this {
    if (this.filters.has(filter.name)) throw new Error(`Filter "${filter.name}" is already registered`);
    this.filters.set(filter.name, filter);
    return this;
  }

  get(name: string): RouteFilter | undefined {
    return this.filters.get(name);
  }

  list(): RouteFilter[] {
    return [...this.filters.values()];
  }

  names(): string[] {
    return [...this.filters.keys()];
  }
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `npx jest test/filters/registry.test.ts`
Expected: PASS, 3 tests.

### Task 3.2: Built-in filters

**Files:**
- Create: `test/filters/built-in.test.ts`, `src/filters/built-in.ts`

- [ ] **Step 1: Write the failing test `test/filters/built-in.test.ts`**

```ts
import { defaultRegistry, endsInSink, hasVulnerability, startsPublic } from '../../src/filters/built-in';
import { fixtureGraph } from '../fixtures';

const graph = fixtureGraph();
const toDb = ['web', 'api', 'db'];
const toQueue = ['web', 'worker', 'queue'];
const lonely = ['lonely'];

describe('built-in filters', () => {
  it('starts-public: first node is publicly exposed', () => {
    expect(startsPublic.matches(toDb, graph)).toBe(true);
    expect(startsPublic.matches(lonely, graph)).toBe(false);
  });

  it('ends-in-sink: last node is rds (sqs is not a sink)', () => {
    expect(endsInSink.matches(toDb, graph)).toBe(true);
    expect(endsInSink.matches(toQueue, graph)).toBe(false);
  });

  it('has-vulnerability: any node has vulnerabilities', () => {
    expect(hasVulnerability.matches(toDb, graph)).toBe(true);
    expect(hasVulnerability.matches(toQueue, graph)).toBe(false);
  });

  it('defaultRegistry exposes the three built-ins', () => {
    expect(defaultRegistry().names()).toEqual(['starts-public', 'ends-in-sink', 'has-vulnerability']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest test/filters/built-in.test.ts`
Expected: FAIL, "Cannot find module '../../src/filters/built-in'".

- [ ] **Step 3: Implement `src/filters/built-in.ts`**

```ts
import { isSink, isVulnerable } from '../graph/node-risk';
import { FilterRegistry } from './registry';
import { RouteFilter } from './types';

export const FilterName = {
  StartsPublic: 'starts-public',
  EndsInSink: 'ends-in-sink',
  HasVulnerability: 'has-vulnerability',
} as const;

export const startsPublic: RouteFilter = {
  name: FilterName.StartsPublic,
  description: 'Route starts at a publicly exposed service',
  matches: (route, graph) => graph.nodes.get(route[0])?.publicExposed === true,
};

export const endsInSink: RouteFilter = {
  name: FilterName.EndsInSink,
  description: 'Route ends at a sink (rds)',
  matches: (route, graph) => {
    const last = graph.nodes.get(route[route.length - 1]);
    return last !== undefined && isSink(last);
  },
};

export const hasVulnerability: RouteFilter = {
  name: FilterName.HasVulnerability,
  description: 'Route passes through a node with at least one vulnerability',
  matches: (route, graph) =>
    route.some((id) => {
      const node = graph.nodes.get(id);
      return node !== undefined && isVulnerable(node);
    }),
};

export function defaultRegistry(): FilterRegistry {
  return new FilterRegistry().register(startsPublic).register(endsInSink).register(hasVulnerability);
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx jest test/filters`
Expected: PASS, 7 tests.

### Task 3.3: Query engine (AND / OR)

**Files:**
- Create: `test/query/query-routes.test.ts`, `src/query/query-routes.ts`

- [ ] **Step 1: Write the failing test `test/query/query-routes.test.ts`**

```ts
import { endsInSink, hasVulnerability, startsPublic } from '../../src/filters/built-in';
import { enumerateRoutes } from '../../src/graph/routes';
import { MatchMode, queryRoutes } from '../../src/query/query-routes';
import { fixtureGraph } from '../fixtures';

const graph = fixtureGraph();
const routes = enumerateRoutes(graph);

describe('queryRoutes', () => {
  it('returns all routes when no filters are given', () => {
    expect(queryRoutes(graph, routes, [], MatchMode.All)).toEqual(routes);
  });

  it('match=all keeps routes passing every filter', () => {
    expect(queryRoutes(graph, routes, [startsPublic, endsInSink, hasVulnerability], MatchMode.All)).toEqual([
      ['web', 'api', 'db'],
    ]);
  });

  it('match=any keeps routes passing at least one filter', () => {
    expect(queryRoutes(graph, routes, [startsPublic, endsInSink], MatchMode.Any)).toEqual([
      ['web', 'api', 'db'],
      ['web', 'worker', 'queue'],
    ]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest test/query`
Expected: FAIL, "Cannot find module '../../src/query/query-routes'".

- [ ] **Step 3: Implement `src/query/query-routes.ts`**

```ts
import { RouteFilter } from '../filters/types';
import { Graph, Route } from '../graph/types';

export const MatchMode = { All: 'all', Any: 'any' } as const;
export type MatchMode = (typeof MatchMode)[keyof typeof MatchMode];

export function queryRoutes(graph: Graph, routes: Route[], filters: RouteFilter[], match: MatchMode): Route[] {
  if (filters.length === 0) return routes;
  return routes.filter((route) =>
    match === MatchMode.All
      ? filters.every((f) => f.matches(route, graph))
      : filters.some((f) => f.matches(route, graph)),
  );
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx jest test/filters test/query`
Expected: PASS, 10 tests.

- [ ] **Step 5: Verify the goal, update the wiki, commit**

Run: `npm run verify` and expect exit 0.

Wiki: create `wiki/pages/api/filters.md` (`category: api`). It covers the `RouteFilter` contract, the built-ins table,
`match=all|any`, and "how to add a filter" in 2 steps (write a `RouteFilter`, then `.register()` it in
`defaultRegistry()`). Add it to `wiki/index.md` under API and log `## [2026-10-22] update | G3 filters`.

```bash
git add src/filters src/query test/filters test/query wiki
git commit -m "feat: pluggable route filters with all/any matching"
```

---

## Goal G4: Render views

**Done when:** `npx jest test/view` is green, and `npm run verify` exits 0.

### Task 4.1: toView (vis shape, risk, hidden counts)

**Files:**
- Create: `test/view/to-view.test.ts`, `src/view/to-view.ts`

- [ ] **Step 1: Write the failing test `test/view/to-view.test.ts`**

```ts
import { toView, viewOfRoutes } from '../../src/view/to-view';
import { fixtureGraph } from '../fixtures';

const graph = fixtureGraph();

describe('toView', () => {
  it('adds vis fields, risk flags and hidden counts', () => {
    const view = toView(graph, ['web'], []);
    expect(view.edges).toEqual([]);
    expect(view.nodes).toEqual([
      expect.objectContaining({
        id: 'web',
        label: 'web',
        group: 'service',
        risk: { public: true, vulnerable: false, maxSeverity: null, sink: false },
        hidden: { in: 0, out: 2 },
      }),
    ]);
  });

  it('reports vulnerability severity and sinks', () => {
    const [api, db] = toView(graph, ['api', 'db'], []).nodes;
    expect(api.risk).toEqual({ public: false, vulnerable: true, maxSeverity: 'high', sink: false });
    expect(db.risk.sink).toBe(true);
  });

  it('includes edge endpoints, dedups edges, and counts only edges not shown as hidden', () => {
    const edge = { id: 'web->api', from: 'web', to: 'api' };
    const view = toView(graph, [], [edge, edge]);
    expect(view.edges).toEqual([edge]);
    expect(view.nodes.map((n) => [n.id, n.hidden])).toEqual([
      ['web', { in: 0, out: 1 }],
      ['api', { in: 0, out: 1 }],
    ]);
  });

  it('skips unknown node ids', () => {
    expect(toView(graph, ['ghost'], []).nodes).toEqual([]);
  });
});

describe('viewOfRoutes', () => {
  it('unions nodes and edges of the routes', () => {
    const view = viewOfRoutes(graph, [['web', 'api', 'db'], ['web', 'worker', 'queue']]);
    expect(view.nodes.map((n) => n.id)).toEqual(['web', 'api', 'db', 'worker', 'queue']);
    expect(view.edges.map((e) => e.id)).toEqual(['web->api', 'api->db', 'web->worker', 'worker->queue']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest test/view/to-view.test.ts`
Expected: FAIL, "Cannot find module '../../src/view/to-view'".

- [ ] **Step 3: Implement `src/view/to-view.ts`**

```ts
import { isSink, isVulnerable, maxSeverity } from '../graph/node-risk';
import { routeEdges } from '../graph/routes';
import { Graph, GraphEdge, GraphNode, Route, edgeId } from '../graph/types';

export interface NodeRisk {
  public: boolean;
  vulnerable: boolean;
  maxSeverity: string | null;
  sink: boolean;
}

/** vis-network node (decision D8) plus risk and the count of edges not in this response. */
export interface ViewNode extends GraphNode {
  label: string;
  group: string;
  risk: NodeRisk;
  hidden: { in: number; out: number };
}

export interface GraphView {
  nodes: ViewNode[];
  edges: GraphEdge[];
}

const nodeRisk = (node: GraphNode): NodeRisk => ({
  public: node.publicExposed,
  vulnerable: isVulnerable(node),
  maxSeverity: maxSeverity(node),
  sink: isSink(node),
});

/** The single place where a response graph is shaped. Edge endpoints are always included. */
export function toView(graph: Graph, nodeIds: Iterable<string>, edges: Iterable<GraphEdge>): GraphView {
  const edgeMap = new Map<string, GraphEdge>();
  for (const e of edges) edgeMap.set(e.id, e);

  const ids = new Set(nodeIds);
  for (const e of edgeMap.values()) {
    ids.add(e.from);
    ids.add(e.to);
  }

  const nodes: ViewNode[] = [];
  for (const id of ids) {
    const node = graph.nodes.get(id);
    if (node === undefined) continue;
    const hiddenOut = (graph.out.get(id) ?? []).filter((to) => !edgeMap.has(edgeId(id, to))).length;
    const hiddenIn = (graph.in.get(id) ?? []).filter((from) => !edgeMap.has(edgeId(from, id))).length;
    nodes.push({ ...node, label: id, group: node.kind, risk: nodeRisk(node), hidden: { in: hiddenIn, out: hiddenOut } });
  }
  return { nodes, edges: [...edgeMap.values()] };
}

export const viewOfRoutes = (graph: Graph, routes: Route[]): GraphView =>
  toView(graph, routes.flat(), routes.flatMap(routeEdges));
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx jest test/view/to-view.test.ts`
Expected: PASS, 5 tests.

### Task 4.2: Risk-first overview

**Files:**
- Create: `test/view/overview.test.ts`, `src/view/overview.ts`

- [ ] **Step 1: Write the failing test `test/view/overview.test.ts`**

```ts
import { enumerateRoutes } from '../../src/graph/routes';
import { buildOverview } from '../../src/view/overview';
import { fixtureGraph } from '../fixtures';

const graph = fixtureGraph();
const routes = enumerateRoutes(graph);

describe('buildOverview', () => {
  it('shows seeds (vulnerable > public > sink) and the vulnerable routes', () => {
    const o = buildOverview(graph, routes, 50);
    expect(o.truncated).toBe(false);
    expect(o.nodes.map((n) => n.id)).toEqual(['api', 'web', 'db']);
    expect(o.edges.map((e) => e.id)).toEqual(['web->api', 'api->db']);
    expect(o.nodes.find((n) => n.id === 'web')?.hidden).toEqual({ in: 0, out: 1 });
  });

  it('respects maxNodes by seed priority and skips routes that do not fit', () => {
    const o = buildOverview(graph, routes, 2);
    expect(o.truncated).toBe(true);
    expect(o.nodes.map((n) => n.id)).toEqual(['api', 'web']);
    expect(o.edges).toEqual([]);
    expect(o.nodes.find((n) => n.id === 'web')?.hidden).toEqual({ in: 0, out: 2 });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest test/view/overview.test.ts`
Expected: FAIL, "Cannot find module '../../src/view/overview'".

- [ ] **Step 3: Implement `src/view/overview.ts`**

```ts
import { endsInSink, hasVulnerability, startsPublic } from '../filters/built-in';
import { isSink, isVulnerable, maxSeverity } from '../graph/node-risk';
import { routeEdges } from '../graph/routes';
import { Graph, GraphNode, Route, routeId, severityRank } from '../graph/types';
import { GraphView, toView } from './to-view';

export const DEFAULT_MAX_NODES = 50;
export const MAX_NODES_LIMIT = 500;

export interface Overview extends GraphView {
  truncated: boolean;
}

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const nodeSeverity = (graph: Graph, id: string): number => {
  const node = graph.nodes.get(id);
  return node === undefined ? 0 : severityRank(maxSeverity(node));
};

/** Priority D10: vulnerable (worst first), then public, then sink. Each group is ordered by id. */
function seedNodes(graph: Graph): GraphNode[] {
  const all = [...graph.nodes.values()];
  const sev = (n: GraphNode): number => severityRank(maxSeverity(n));
  return [
    ...all.filter(isVulnerable).sort((a, b) => sev(b) - sev(a) || byId(a.id, b.id)),
    ...all.filter((n) => n.publicExposed && !isVulnerable(n)).sort((a, b) => byId(a.id, b.id)),
    ...all.filter((n) => isSink(n) && !isVulnerable(n) && !n.publicExposed).sort((a, b) => byId(a.id, b.id)),
  ];
}

/** Routes through a vulnerable node: worst severity, then starts public, then ends in sink, then id. */
function rankRiskRoutes(graph: Graph, routes: Route[]): Route[] {
  const keyed = routes
    .filter((r) => hasVulnerability.matches(r, graph))
    .map((r) => ({
      route: r,
      id: routeId(r),
      severity: Math.max(...r.map((id) => nodeSeverity(graph, id))),
      pub: startsPublic.matches(r, graph) ? 1 : 0,
      sink: endsInSink.matches(r, graph) ? 1 : 0,
    }));
  keyed.sort((a, b) => b.severity - a.severity || b.pub - a.pub || b.sink - a.sink || byId(a.id, b.id));
  return keyed.map((k) => k.route);
}

/** First screen for the AppSec user (spec §7). Deterministic. */
export function buildOverview(graph: Graph, routes: Route[], maxNodes: number = DEFAULT_MAX_NODES): Overview {
  const nodeIds = new Set<string>();
  let truncated = false;

  for (const seed of seedNodes(graph)) {
    if (nodeIds.size >= maxNodes) {
      truncated = true;
      break;
    }
    nodeIds.add(seed.id);
  }

  const included: Route[] = [];
  for (const route of rankRiskRoutes(graph, routes)) {
    const added = route.filter((id) => !nodeIds.has(id)).length;
    if (nodeIds.size + added > maxNodes) {
      truncated = true;
      continue;
    }
    route.forEach((id) => nodeIds.add(id));
    included.push(route);
  }

  return { ...toView(graph, nodeIds, included.flatMap(routeEdges)), truncated };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx jest test/view/overview.test.ts`
Expected: PASS, 2 tests.

### Task 4.3: Node expansion

**Files:**
- Create: `test/view/expand.test.ts`, `src/view/expand.ts`

- [ ] **Step 1: Write the failing test `test/view/expand.test.ts`**

```ts
import { Direction, expandNode } from '../../src/view/expand';
import { fixtureGraph } from '../fixtures';

const graph = fixtureGraph();

describe('expandNode', () => {
  it('both: node plus in and out neighbors with hidden counts', () => {
    const view = expandNode(graph, 'web', Direction.Both);
    expect(view?.edges.map((e) => e.id)).toEqual(['web->api', 'web->worker']);
    expect(view?.nodes.map((n) => [n.id, n.hidden])).toEqual([
      ['web', { in: 0, out: 0 }],
      ['api', { in: 0, out: 1 }],
      ['worker', { in: 0, out: 1 }],
    ]);
  });

  it('in: only upstream callers', () => {
    const view = expandNode(graph, 'api', Direction.In);
    expect(view?.edges.map((e) => e.id)).toEqual(['web->api']);
    expect(view?.nodes.map((n) => n.id)).toEqual(['api', 'web']);
  });

  it('out: only downstream callees', () => {
    expect(expandNode(graph, 'api', Direction.Out)?.edges.map((e) => e.id)).toEqual(['api->db']);
  });

  it('returns undefined for an unknown node', () => {
    expect(expandNode(graph, 'ghost', Direction.Both)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest test/view/expand.test.ts`
Expected: FAIL, "Cannot find module '../../src/view/expand'".

- [ ] **Step 3: Implement `src/view/expand.ts`**

```ts
import { Graph, GraphEdge, edgeId } from '../graph/types';
import { GraphView, toView } from './to-view';

export const Direction = { In: 'in', Out: 'out', Both: 'both' } as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

/** One hop around a node (decision D9: stateless, the client merges by id). Undefined when the node is unknown. */
export function expandNode(graph: Graph, id: string, direction: Direction): GraphView | undefined {
  if (!graph.nodes.has(id)) return undefined;
  const edges: GraphEdge[] = [];
  if (direction !== Direction.In) {
    for (const to of graph.out.get(id) ?? []) edges.push({ id: edgeId(id, to), from: id, to });
  }
  if (direction !== Direction.Out) {
    for (const from of graph.in.get(id) ?? []) edges.push({ id: edgeId(from, id), from, to: id });
  }
  return toView(graph, [id], edges);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx jest test/view`
Expected: PASS, 11 tests.

- [ ] **Step 5: Verify the goal, update the wiki, commit**

Run: `npm run verify` and expect exit 0.

Wiki: add a "Views" section to `wiki/pages/architecture/overview.md` covering `toView`, the overview algorithm, and
expansion, and what `hidden` means. Log `## [2026-10-22] update | G4 views`.

```bash
git add src/view test/view wiki
git commit -m "feat: vis-ready views, risk-first overview and node expansion"
```

---

## Goal G5: HTTP API + server

**Done when:** `npx jest test/api` is green, `npm run verify` exits 0, and after `npm start`,
`curl localhost:3000/graph/overview` returns JSON with `meta.shownNodes: 25`.

### Task 5.1: Query schemas

**Files:**
- Create: `src/api/query-schemas.ts`

These are tested through the API tests in Task 5.2.

- [ ] **Step 1: Implement `src/api/query-schemas.ts`**

```ts
import { z } from 'zod';
import { MatchMode } from '../query/query-routes';
import { Direction } from '../view/expand';
import { DEFAULT_MAX_NODES, MAX_NODES_LIMIT } from '../view/overview';

export const OverviewQuery = z.object({
  maxNodes: z.coerce.number().int().min(1).max(MAX_NODES_LIMIT).default(DEFAULT_MAX_NODES),
});

export const NeighborsQuery = z.object({
  direction: z.nativeEnum(Direction).default(Direction.Both),
});

/** Accepts `?filters=a,b` and `?filters=a&filters=b`. Trims, drops empties, dedups. */
export const RoutesQuery = z.object({
  filters: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      const parts = (v === undefined ? [] : Array.isArray(v) ? v : [v]).flatMap((s) => s.split(','));
      return [...new Set(parts.map((s) => s.trim()).filter((s) => s.length > 0))];
    }),
  match: z.nativeEnum(MatchMode).default(MatchMode.All),
});
```

### Task 5.2: Express app

**Files:**
- Create: `test/api/app.test.ts`, `src/api/app.ts`

- [ ] **Step 1: Write the failing test `test/api/app.test.ts`**

```ts
import request from 'supertest';
import { createApp } from '../../src/api/app';
import { defaultRegistry } from '../../src/filters/built-in';
import { enumerateRoutes } from '../../src/graph/routes';
import { fixtureGraph } from '../fixtures';

const graph = fixtureGraph();
const app = createApp({ graph, routes: enumerateRoutes(graph), registry: defaultRegistry() });

describe('API', () => {
  it('GET /health', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /graph returns the full graph in vis shape', async () => {
    const res = await request(app).get('/graph').expect(200);
    expect(res.body.nodes).toHaveLength(6);
    expect(res.body.edges).toHaveLength(4);
    expect(res.body.edges[0]).toEqual({ id: 'web->api', from: 'web', to: 'api' });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  describe('GET /graph/overview', () => {
    it('returns the risk view with meta', async () => {
      const res = await request(app).get('/graph/overview').expect(200);
      expect(res.body.meta).toEqual({ totalNodes: 6, shownNodes: 3, truncated: false });
      expect(res.body.nodes[0]).toMatchObject({ id: 'api', label: 'api', group: 'service' });
    });

    it('honours maxNodes', async () => {
      const res = await request(app).get('/graph/overview?maxNodes=2').expect(200);
      expect(res.body.meta).toEqual({ totalNodes: 6, shownNodes: 2, truncated: true });
    });

    it.each(['0', '501', 'abc'])('400 for maxNodes=%s', async (v) => {
      const res = await request(app).get(`/graph/overview?maxNodes=${v}`).expect(400);
      expect(res.body.error).toMatch(/maxNodes/);
    });
  });

  describe('GET /nodes/:id/neighbors', () => {
    it('expands both directions by default', async () => {
      const res = await request(app).get('/nodes/web/neighbors').expect(200);
      expect(res.body.nodes.map((n: { id: string }) => n.id)).toEqual(['web', 'api', 'worker']);
    });

    it('honours direction', async () => {
      const res = await request(app).get('/nodes/api/neighbors?direction=out').expect(200);
      expect(res.body.edges).toEqual([{ id: 'api->db', from: 'api', to: 'db' }]);
    });

    it('400 for a bad direction', async () => {
      await request(app).get('/nodes/web/neighbors?direction=sideways').expect(400);
    });

    it('404 for an unknown node', async () => {
      const res = await request(app).get('/nodes/ghost/neighbors').expect(404);
      expect(res.body.error).toMatch(/ghost/);
    });
  });

  it('GET /filters lists filters', async () => {
    const res = await request(app).get('/filters').expect(200);
    expect(res.body.map((f: { name: string }) => f.name)).toEqual(['starts-public', 'ends-in-sink', 'has-vulnerability']);
  });

  describe('GET /routes', () => {
    it('returns every route without filters', async () => {
      const res = await request(app).get('/routes').expect(200);
      expect(res.body.meta).toEqual({ filters: [], match: 'all', totalRoutes: 3, matchedRoutes: 3 });
    });

    it.each([
      '/routes?filters=starts-public,ends-in-sink',
      '/routes?filters=starts-public&filters=ends-in-sink',
    ])('ANDs filters: %s', async (url) => {
      const res = await request(app).get(url).expect(200);
      expect(res.body.routes).toEqual([{ id: 'web>api>db', nodes: ['web', 'api', 'db'] }]);
      expect(res.body.edges.map((e: { id: string }) => e.id)).toEqual(['web->api', 'api->db']);
    });

    it('ORs filters with match=any', async () => {
      const res = await request(app).get('/routes?filters=starts-public,ends-in-sink&match=any').expect(200);
      expect(res.body.meta.matchedRoutes).toBe(2);
    });

    it('400 with validFilters for an unknown filter', async () => {
      const res = await request(app).get('/routes?filters=starts-public,bogus').expect(400);
      expect(res.body.error).toMatch(/bogus/);
      expect(res.body.validFilters).toEqual(['starts-public', 'ends-in-sink', 'has-vulnerability']);
    });

    it('400 for a bad match', async () => {
      await request(app).get('/routes?match=xor').expect(400);
    });
  });

  it('404 JSON for an unknown path', async () => {
    const res = await request(app).get('/nope').expect(404);
    expect(res.body).toEqual({ error: 'Not found: GET /nope' });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest test/api`
Expected: FAIL, "Cannot find module '../../src/api/app'".

- [ ] **Step 3: Implement `src/api/app.ts`**

```ts
import express, { Express, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { FilterRegistry } from '../filters/registry';
import { RouteFilter } from '../filters/types';
import { Graph, Route, routeId } from '../graph/types';
import { queryRoutes } from '../query/query-routes';
import { expandNode } from '../view/expand';
import { buildOverview } from '../view/overview';
import { toView, viewOfRoutes } from '../view/to-view';
import { NeighborsQuery, OverviewQuery, RoutesQuery } from './query-schemas';

export interface AppDeps {
  graph: Graph;
  routes: Route[];
  registry: FilterRegistry;
}

const badRequest = (res: Response, error: ZodError): void => {
  res.status(400).json({ error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
};

export function createApp({ graph, routes, registry }: AppDeps): Express {
  const app = express();

  // The vis-network UI may be served from another origin. GET only, so no preflight handling is needed.
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/graph', (_req, res) => {
    res.json(toView(graph, graph.nodes.keys(), graph.edges));
  });

  app.get('/graph/overview', (req, res) => {
    const query = OverviewQuery.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const { nodes, edges, truncated } = buildOverview(graph, routes, query.data.maxNodes);
    res.json({ nodes, edges, meta: { totalNodes: graph.nodes.size, shownNodes: nodes.length, truncated } });
  });

  app.get('/nodes/:id/neighbors', (req, res) => {
    const query = NeighborsQuery.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const view = expandNode(graph, req.params.id, query.data.direction);
    if (view === undefined) {
      res.status(404).json({ error: `Unknown node: ${req.params.id}` });
      return;
    }
    res.json(view);
  });

  app.get('/filters', (_req, res) => {
    res.json(registry.list().map(({ name, description }) => ({ name, description })));
  });

  app.get('/routes', (req, res) => {
    const query = RoutesQuery.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const { filters: names, match } = query.data;

    const unknown = names.filter((n) => registry.get(n) === undefined);
    if (unknown.length > 0) {
      res.status(400).json({ error: `Unknown filter(s): ${unknown.join(', ')}`, validFilters: registry.names() });
      return;
    }
    const filters = names.map((n) => registry.get(n)).filter((f): f is RouteFilter => f !== undefined);

    const matched = queryRoutes(graph, routes, filters, match);
    res.json({
      ...viewOfRoutes(graph, matched),
      routes: matched.map((r) => ({ id: routeId(r), nodes: r })),
      meta: { filters: names, match, totalRoutes: routes.length, matchedRoutes: matched.length },
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx jest test/api`
Expected: PASS, every test in the file.

### Task 5.3: Engine bootstrap and server entry

**Files:**
- Create: `src/engine.ts`
- Modify: `src/main.ts` (replace the placeholder)

- [ ] **Step 1: Create `src/engine.ts`**

```ts
import { AppDeps } from './api/app';
import { defaultRegistry } from './filters/built-in';
import { loadGraph } from './graph/load-graph';
import { enumerateRoutes } from './graph/routes';

/** Builds everything the app needs from raw JSON. Pure, so the smoke test can reuse it. */
export function createEngine(raw: unknown): { deps: AppDeps; warnings: string[] } {
  const { graph, warnings } = loadGraph(raw);
  return { deps: { graph, routes: enumerateRoutes(graph), registry: defaultRegistry() }, warnings };
}
```

- [ ] **Step 2: Replace `src/main.ts`**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './api/app';
import { createEngine } from './engine';

const dataFile = process.env.GRAPH_FILE ?? path.join(__dirname, '..', 'data', 'train-ticket-be.json');
const port = Number(process.env.PORT ?? 3000);

const { deps, warnings } = createEngine(JSON.parse(readFileSync(dataFile, 'utf8')));
warnings.forEach((w) => console.warn(`[load-graph] ${w}`));

createApp(deps).listen(port, () => {
  console.log(
    `Graph query engine on http://localhost:${port} ` +
      `(${deps.graph.nodes.size} nodes, ${deps.graph.edges.length} edges, ${deps.routes.length} routes)`,
  );
});
```

- [ ] **Step 3: Verify the goal and check it by hand**

Run: `npm run verify` and expect exit 0.
Run: `npm start` in the background, then `curl -s localhost:3000/graph/overview`.
Expected: the log prints `[load-graph] Node "assurance-service" …` and `47 nodes, 98 edges, 222 routes`, and the JSON
`meta` is `{"totalNodes":47,"shownNodes":25,"truncated":false}`. Stop the server afterwards.

- [ ] **Step 4: Update the wiki, commit**

Wiki: create `wiki/pages/api/endpoints.md` (`category: api`) with the endpoint table, the response shapes, and the
error codes from spec §8. Add it to the index. Log `## [2026-10-22] update | G5 HTTP API`.

```bash
git add src/api src/engine.ts src/main.ts test/api wiki
git commit -m "feat: REST API for overview, expansion, filters and routes"
```

---

## Goal G6: Real-data verification + docs

**Done when:** `npx jest test/smoke.test.ts` is green with the spec's numbers, `npm run verify` exits 0, and the README
covers every item in spec §11.

### Task 6.1: Smoke test on the real data

**Files:**
- Create: `test/smoke.test.ts`

- [ ] **Step 1: Write the test `test/smoke.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createEngine } from '../src/engine';
import { endsInSink, hasVulnerability, startsPublic } from '../src/filters/built-in';
import { MatchMode, queryRoutes } from '../src/query/query-routes';
import { buildOverview } from '../src/view/overview';

const raw: unknown = JSON.parse(readFileSync(path.join(__dirname, '..', 'data', 'train-ticket-be.json'), 'utf8'));
const { deps, warnings } = createEngine(raw);
const { graph, routes } = deps;
const count = (filters: Parameters<typeof queryRoutes>[2]): number =>
  queryRoutes(graph, routes, filters, MatchMode.All).length;

describe('Train Ticket data', () => {
  it('loads with the dangling assurance-service synthesized', () => {
    expect(graph.nodes.size).toBe(47);
    expect(graph.edges).toHaveLength(98);
    expect(graph.nodes.get('assurance-service')?.inferred).toBe(true);
    expect(warnings).toHaveLength(1);
  });

  it('has the expected routes and filter counts', () => {
    expect(routes).toHaveLength(222);
    expect(count([startsPublic])).toBe(6);
    expect(count([endsInSink])).toBe(30);
    expect(count([hasVulnerability])).toBe(60);
    expect(count([startsPublic, endsInSink, hasVulnerability])).toBe(0);
  });

  it('builds the risk-first overview', () => {
    const o = buildOverview(graph, routes);
    expect(o.truncated).toBe(false);
    expect(o.nodes).toHaveLength(25);
    expect(o.edges).toHaveLength(42);
    expect(o.nodes.slice(0, 2).map((n) => n.id)).toEqual(['order-service', 'auth-service']);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest test/smoke.test.ts`
Expected: PASS, 3 tests. If a number differs, **do not edit the expected value to match**. Find out why first
(superpowers:systematic-debugging). The numbers were computed independently from the raw JSON.

- [ ] **Step 3: Commit**

```bash
git add test/smoke.test.ts
git commit -m "test: smoke test against the Train Ticket data"
```

### Task 6.2: README and final wiki pass

**Files:**
- Create: `README.md`
- Modify: wiki pages and the index

- [ ] **Step 1: Write `README.md`** with these sections, in this order:

1. **What it is.** One paragraph, plus the persona and job (spec §2).
2. **Run.** `npm install`, `npm run build`, `npm start` (`PORT`, `GRAPH_FILE` env), `npm test`, `npm run verify`.
3. **API.** The endpoint table from spec §8, plus these curl examples:
   ```bash
   curl localhost:3000/graph/overview
   curl "localhost:3000/nodes/order-service/neighbors?direction=in"
   curl "localhost:3000/routes?filters=has-vulnerability,ends-in-sink"
   curl "localhost:3000/routes?filters=starts-public,ends-in-sink,has-vulnerability"   # → 0 routes, see Findings
   ```
4. **Rendering with vis-network.** This snippet:
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
   Note: `hidden` is relative to the response that carried it. After several expansions, a badge may overstate what is
   still hidden. The client can recompute it from its DataSets.
5. **Adding a filter.** Write a `RouteFilter`, `.register()` it in `defaultRegistry()`, done. Show the `long-route`
   example from `test/filters/registry.test.ts`.
6. **Decisions.** D1–D10, one line each, linking to the spec.
7. **Data findings.** The `to` string quirk; the dangling `assurance-service`; the CWE and message mismatch on
   `auth-service`; both vulnerable services reach `prod-postgresdb`; `gateway-service` is public but has no edges, so
   the attack-path AND returns 0.
8. **Limitations / next steps.** The UI itself; clustering for very large graphs; `hidden` is per response;
   enumeration starts only at in-degree-0 nodes, so a pure cycle with no entry yields no routes; no pagination of
   `/routes`.

- [ ] **Step 2: Final wiki pass**

Check that every page created in G2–G5 is in `wiki/index.md`. Update `wiki/pages/domain/graph-data.md` with the
verified counts (47 nodes, 98 edges, 222 routes). Log `## [2026-10-22] update | G6 smoke test + README`.

- [ ] **Step 3: Final verification**

Run: `npm run verify`
Expected: exit 0. All suites pass: load-graph, routes, registry, built-in, query-routes, to-view, overview, expand, app,
and smoke.

- [ ] **Step 4: Commit**

```bash
git add README.md wiki
git commit -m "docs: README with API, vis-network usage, decisions and data findings"
```

---

## Spec coverage check

| Spec section | Covered by |
|---|---|
| §2 persona / JTBD | README (6.2) |
| §3 D1–D10 | G1 (D1), types (D2), query (D3), load (D4), routes (D5, D6), engine (D7), toView (D8), expand (D9), overview (D10) |
| §4 normalization | Task 2.2 |
| §5 domain + view model | Tasks 2.1, 4.1 |
| §6 filters | G3 |
| §7 overview / expand | Tasks 4.2, 4.3 |
| §8 REST API + errors + expected numbers | Tasks 5.2, 6.1 |
| §9 module layout | File map (adds `node-risk.ts`, `engine.ts`, `query-schemas.ts`) |
| §10 testing | Every goal |
| §11 deliverables | Task 6.2 + wiki steps |
