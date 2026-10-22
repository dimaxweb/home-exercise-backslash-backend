---
title: Monorepo and UI
category: decisions
tags: [nx, monorepo, ui, vis-network, react]
sources: [docs/superpowers/specs/2026-10-22-graph-query-engine-design.md, nx.json, eslint.config.mjs, apps/web/src]
updated: 2026-10-22
---

Requested on 2026-10-22 after the backend (G1–G6) was done. This is spec §12, decisions D11–D15, plan goal G7.

## D11 Nx integrated monorepo

| Project | Tags | Depends on |
|---|---|---|
| `libs/api-contract` | `scope:shared`, `type:util` | nothing |
| `libs/graph-engine` | `scope:api`, `type:feature` | api-contract |
| `apps/api` | `scope:api`, `type:app` | graph-engine, api-contract |
| `apps/web` | `scope:web`, `type:app` | api-contract only |

- `@nx/enforce-module-boundaries` in `eslint.config.mjs`: each scope may use only itself and `scope:shared`, and
  `type:util` may depend only on `type:util`.
- Classic path-alias mode (`tsconfig.base.json` paths), not TS project references. It was simpler for an existing repo.
- Pinned to `nx@23.3.0`. 24.0.0 was a day old, so it was skipped under the "at least 2 weeks old" rule.
  TypeScript went up to 5.9.3 because Nx 23 needs 5.8 or newer.
- The api builds with esbuild, `bundle: true, thirdParty: false`. Workspace libs are inlined, because path aliases
  don't exist at runtime, and npm packages stay external.
- The engine tests kept their `test/` layout and assertions. The shared fixture lives at
  `@backslash/graph-engine/testing`.
- `edgeId` moved into api-contract because it is a wire format: the client builds route edge ids to highlight a route.

## D12 Express stays

The project skill prefers NestJS + class-validator. CLAUDE.md and spec D1 (Express + zod) win. Migrating would add
no behavior.

## D13 UI stack

React 19, `vis-network` standalone (it bundles `DataSet`, so no peer packages are needed), and TanStack Query for
overview, filter, route and neighbor fetches. There's no router and no global store. The vis DataSets live in one
hook (`use-graph-data.ts`), and React re-renders only the side panels.

## D14 `/api` proxy

The UI calls `/api/*`. Vite (`serve` and `preview`) proxies it to `API_URL` (default `http://localhost:3000`) and
strips the prefix, so the API itself didn't change. `npm run dev` = `nx run-many -t serve -p api web`.

## D15 Client-side `hidden`

The server's `hidden` is per response. The first time the client sees a node, it records the node's total degree
(`hidden` + the response edges touching it). The `+n` badge is that total minus the edges in the DataSet.
`recordDegrees` and `hiddenCounts` in `vis-mapping.ts` are pure and unit-tested.

## Verification (2026-10-22)

- `npm run verify` (lint, typecheck, test, build for 4 projects): 30 engine tests + 22 api tests + 9 web tests.
- Headless Edge was driven over CDP:
  - The overview shows 25/47 nodes and 42 edges.
  - Clicking `frontend` shows "1 edge not shown". Expanding it gives 26 nodes, 43 edges and "All edges … on the canvas".
  - `has-vulnerability AND ends-in-sink` gives 30/222 routes, and highlighting a route works.
  - The attack-path AND shows 0 routes with its explanation.
  - No console errors.

> ❓ OPEN: no automated e2e suite for canvas interactions. The bundle is about 920 kB because of vis-network.
