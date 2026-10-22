---
title: Decision — what is a route
category: decisions
tags: [routes, filters]
sources: [docs/superpowers/specs/2026-10-22-graph-query-engine-design.md]
updated: 2026-10-22
---

## Decision (2026-10-22)

Route = maximal path: from an entry node (in-degree 0) to a terminal node (out-degree 0). An isolated node is a 1-node
route. Enumeration guards against cycles even though the data is acyclic.

On the real data: 222 routes (vs 440 if every sub-path counted). Rejected "all sub-paths" because it duplicates prefixes
and adds noise for a renderer.

## Consequences

- `starts-public` → 6 routes, `ends-in-sink` → 30.
- All three filters ANDed → **0**: no public node reaches `prod-postgresdb` (`gateway-service` has no outgoing edges,
  and `frontend` reaches only the admin-basic-info subtree). This is a property of the data, not a bug. See [[graph-data]].

Filter combination: `match=all` (default) or `match=any`.
