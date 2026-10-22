---
title: Decision — persona, risk-first overview, progressive expansion
category: decisions
tags: [ui, vis-network, overview, persona]
sources: [docs/superpowers/specs/2026-10-22-graph-query-engine-design.md]
updated: 2026-10-22
---

## Persona and job (assumption, 2026-10-22)

The user is an AppSec engineer. Their job: *"show me which flagged vulnerabilities are reachable and lead to sensitive
data, so I fix those first."* The three filters form an attack path: public entry → vulnerable → sink
([[sink-definition]], [[route-definition]]).

## Decision

- The UI is **vis-network** (canvas). The API returns nodes `{ id, label, group }` and edges `{ id, from, to }`, so a
  response loads straight into a vis `DataSet` (D8).
- The first screen is `GET /graph/overview`. It contains vulnerable nodes, public entries, sinks, and the
  `has-vulnerability` routes, capped by `maxNodes` (default 50). The priority is vulnerable > public > sink (D10).
- Every node carries `hidden: { in, out }`, the number of its edges not in the response. The UI uses it to draw expand
  badges.
- Expansion is `GET /nodes/:id/neighbors` and is **stateless**. The client merges results by id, and the server keeps
  no record of what a client has (D9).

## Why

- Real customer graphs are too big to render whole. A risk-first view serves the job directly.
- Stateless expansion relies on vis's id-based merge, so there are no sessions to manage.
- Rejected: server-side clustering (the grouping rules would be guesswork) and paginated routes (a list of paths is not
  an explorable graph).

## Data facts

The graph has 47 nodes and 98 edges, so it renders fine in full. The overview has 25 nodes and 42 edges, from 60 of 222 routes.
Both vulnerable services (`order-service`, `auth-service`) reach `prod-postgresdb`. Neither public node reaches a
vulnerable service, because `gateway-service` has no edges.

> ❓ OPEN: is the missing `gateway-service` wiring a data gap? If it called the services, the attack-path AND would not
> be empty.
