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
