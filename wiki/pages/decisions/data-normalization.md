---
title: Decision — normalize raw graph data at load
category: decisions
tags: [data, normalization]
sources: [docs/superpowers/specs/2026-10-22-graph-query-engine-design.md]
updated: 2026-10-22
---

## Decision (2026-10-22)

All quirks in [[graph-data]] are fixed once, at load. The engine only sees the normalized `Graph`.

- String `to` → array.
- Dangling target (`assurance-service`) → synthesized node `{ kind: service, inferred: true }` + warning log.
  Alternative rejected: dropping the edges loses 2 real call relations.
- Missing `publicExposed` → `false`, missing `vulnerabilities` → `[]`.
- Duplicate edges deduplicated. Raw JSON validated with zod; invalid input fails startup.
