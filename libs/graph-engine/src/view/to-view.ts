import { GraphView, NodeRisk, ViewNode } from '@backslash/api-contract';
import { isSink, isVulnerable, maxSeverity } from '../graph/node-risk';
import { routeEdges } from '../graph/routes';
import { Graph, GraphEdge, GraphNode, Route, edgeId } from '../graph/types';

export type { GraphView, NodeRisk, ViewNode } from '@backslash/api-contract';

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
