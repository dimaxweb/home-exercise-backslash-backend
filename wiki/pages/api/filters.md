---
title: Route filters
category: api
tags: [filters, extensibility, query]
sources: [src/filters/types.ts, src/filters/built-in.ts, src/query/query-routes.ts]
updated: 2026-10-22
---

## Contract

```ts
interface RouteFilter {
  name: string;          // kebab-case, used in ?filters=
  description: string;   // shown by GET /filters
  matches(route: Route, graph: Graph): boolean;   // must be pure
}
```

`FilterRegistry` provides `register(f)`, which throws on a duplicate name and is chainable, plus `get(name)`,
`list()` and `names()`.

## Built-ins

| name | matches when |
|---|---|
| `starts-public` | first node has `publicExposed === true` |
| `ends-in-sink` | last node's kind is in `SINK_KINDS` (`rds` only, see [[sink-definition]]) |
| `has-vulnerability` | some node on the route has at least one vulnerability |

## Combining

`queryRoutes(graph, routes, filters, match)`. With `match=all` (the default) a route must pass every filter. With
`match=any` it must pass at least one. With no filters, every route is returned.

## Adding a filter

1. Write a `RouteFilter` object, for example in `src/filters/built-in.ts`.
2. `.register()` it in `defaultRegistry()`.

You don't touch the engine, controller or validation: the API resolves names through the registry, and
`GET /filters` and the 400 `validFilters` list pick the new filter up automatically.
