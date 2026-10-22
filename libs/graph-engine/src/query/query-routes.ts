import { MatchMode } from '@backslash/api-contract';
import { RouteFilter } from '../filters/types';
import { Graph, Route } from '../graph/types';

export { MatchMode } from '@backslash/api-contract';

export function queryRoutes(graph: Graph, routes: Route[], filters: RouteFilter[], match: MatchMode): Route[] {
  if (filters.length === 0) return routes;
  return routes.filter((route) =>
    match === MatchMode.All
      ? filters.every((f) => f.matches(route, graph))
      : filters.some((f) => f.matches(route, graph)),
  );
}
