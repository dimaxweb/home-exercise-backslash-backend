---
title: Train Ticket graph data
category: domain
tags: [data, graph, quirks]
sources: [raw/train-ticket-be.json]
updated: 2026-10-22
---

## Shape

`{ nodes: Node[], edges: { from: string, to: string[] }[] }` — 46 nodes, 27 edge groups (adjacency-list form).

Node fields: `name` (id), `kind`, `language`, `path`, `publicExposed?`, `vulnerabilities?[]`, `metadata?`.

| kind | count | names |
|---|---|---|
| `service` | 44 | … |
| `rds` | 1 | `prod-postgresdb` (postgres 9.6, AWS) |
| `sqs` | 1 | `prod-sqs` (AWS) |

- Public (`publicExposed: true`): `frontend`, `gateway-service`.
- With vulnerabilities: `auth-service`, `order-service`. A vulnerability has `file`, `severity`, `message`, `metadata.cwe`.
- Edges into sinks: `auth-service → prod-postgresdb`, `order-service → prod-postgresdb`,
  `inside-payment-service → prod-sqs`, `rebook-service → prod-sqs`.
- The graph is **acyclic** from the public entry points (checked 2026-10-22). The engine must still guard against cycles.

## Quirks (must be normalized at load)

1. **`to` is sometimes a string, not an array**: `{ from: "consign-service", to: "consign-price-service" }`.
2. **Dangling reference**: `assurance-service` is an edge target (from `preserve-service`, `preserve-other-service`)
   but has no node entry. See [[data-normalization]].
3. `publicExposed` and `vulnerabilities` are optional → treat missing as `false` / `[]`.
4. Vulnerability `message` (SQL injection) and `cwe` (Path Traversal) disagree on auth-service — source data issue,
   passed through as-is.

## Sinks

Assignment says "end in Sink (rds/sql)". Only `rds` exists in data; `sqs` is a queue, not a sink by that definition.
See [[sink-definition]].
