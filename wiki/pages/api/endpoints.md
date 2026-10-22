---
title: REST endpoints
category: api
tags: [api, rest, vis-network]
sources: [src/api/app.ts, src/api/query-schemas.ts, docs/superpowers/specs/2026-10-22-graph-query-engine-design.md]
updated: 2026-10-22
---

## Endpoints

| Method & path | Response |
|---|---|
| `GET /health` | `{ status: "ok" }` |
| `GET /graph/overview?maxNodes=50` | `GraphView & { meta: { totalNodes, shownNodes, truncated } }`, the first screen |
| `GET /nodes/:id/neighbors?direction=in\|out\|both` | `GraphView` for one-hop expansion (default `both`) |
| `GET /graph` | `GraphView` of the full graph (for small graphs and debugging) |
| `GET /filters` | `[{ name, description }]` from the registry ([[filters]]) |
| `GET /routes?filters=a,b&match=all\|any` | `GraphView & { routes, meta }` |

`filters` accepts both `a,b` and the repeated form `filters=a&filters=b`. Names are trimmed and deduped.

## Shapes

- `GraphView = { nodes: ViewNode[], edges: { id, from, to }[] }`. A `ViewNode` is the normalized node plus
  `label`, `group`, `risk` and `hidden` (see [[overview]] → Views).
- `/routes` adds `routes: { id: nodes.join('>'), nodes }[]` and
  `meta: { filters, match, totalRoutes, matchedRoutes }`.
- CORS: every response sends `Access-Control-Allow-Origin: *`. All endpoints are GET only.

## Errors

| Case | Status | Body |
|---|---|---|
| `maxNodes` outside 1–500 or not an integer | 400 | `{ error }` (names the field) |
| bad `direction` / `match` | 400 | `{ error }` |
| unknown filter name | 400 | `{ error, validFilters }` |
| unknown node id | 404 | `{ error: "Unknown node: <id>" }` |
| unknown path | 404 | `{ error: "Not found: GET /x" }` |
| unexpected exception | 500 | `{ error: "Internal server error" }` |

## Server

`npm start` serves on `PORT` (default 3000) and loads `GRAPH_FILE` (default `data/train-ticket-be.json`). Load
warnings are printed with the prefix `[load-graph]`.
