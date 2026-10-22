import { endsInSink, hasVulnerability, startsPublic } from '../filters/built-in';
import { isSink, isVulnerable, maxSeverity } from '../graph/node-risk';
import { routeEdges } from '../graph/routes';
import { Graph, GraphNode, Route, routeId, severityRank } from '../graph/types';
import { GraphView, toView } from './to-view';

export const DEFAULT_MAX_NODES = 50;
export const MAX_NODES_LIMIT = 500;

export interface Overview extends GraphView {
  truncated: boolean;
}

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const nodeSeverity = (graph: Graph, id: string): number => {
  const node = graph.nodes.get(id);
  return node === undefined ? 0 : severityRank(maxSeverity(node));
};

/** Priority D10: vulnerable (worst first), then public, then sink. Each group is ordered by id. */
function seedNodes(graph: Graph): GraphNode[] {
  const all = [...graph.nodes.values()];
  const sev = (n: GraphNode): number => severityRank(maxSeverity(n));
  return [
    ...all.filter(isVulnerable).sort((a, b) => sev(b) - sev(a) || byId(a.id, b.id)),
    ...all.filter((n) => n.publicExposed && !isVulnerable(n)).sort((a, b) => byId(a.id, b.id)),
    ...all.filter((n) => isSink(n) && !isVulnerable(n) && !n.publicExposed).sort((a, b) => byId(a.id, b.id)),
  ];
}

/** Routes through a vulnerable node: worst severity, then starts public, then ends in sink, then id. */
function rankRiskRoutes(graph: Graph, routes: Route[]): Route[] {
  const keyed = routes
    .filter((r) => hasVulnerability.matches(r, graph))
    .map((r) => ({
      route: r,
      id: routeId(r),
      severity: Math.max(...r.map((id) => nodeSeverity(graph, id))),
      pub: startsPublic.matches(r, graph) ? 1 : 0,
      sink: endsInSink.matches(r, graph) ? 1 : 0,
    }));
  keyed.sort((a, b) => b.severity - a.severity || b.pub - a.pub || b.sink - a.sink || byId(a.id, b.id));
  return keyed.map((k) => k.route);
}

/** First screen for the AppSec user (spec §7). Deterministic. */
export function buildOverview(graph: Graph, routes: Route[], maxNodes: number = DEFAULT_MAX_NODES): Overview {
  const nodeIds = new Set<string>();
  let truncated = false;

  for (const seed of seedNodes(graph)) {
    if (nodeIds.size >= maxNodes) {
      truncated = true;
      break;
    }
    nodeIds.add(seed.id);
  }

  const included: Route[] = [];
  for (const route of rankRiskRoutes(graph, routes)) {
    const added = route.filter((id) => !nodeIds.has(id)).length;
    if (nodeIds.size + added > maxNodes) {
      truncated = true;
      continue;
    }
    route.forEach((id) => nodeIds.add(id));
    included.push(route);
  }

  return { ...toView(graph, nodeIds, included.flatMap(routeEdges)), truncated };
}
