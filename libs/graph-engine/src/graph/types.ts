import { GraphEdge, GraphNode, NodeKind, Severity } from '@backslash/api-contract';

export { NodeKind, Severity, edgeId } from '@backslash/api-contract';
export type { GraphEdge, GraphNode, Vulnerability } from '@backslash/api-contract';

/** Kinds that count as a data sink. `sqs` is a queue, not a sink (decision D2). */
export const SINK_KINDS: ReadonlySet<string> = new Set<string>([NodeKind.Rds]);

const SEVERITY_RANK: Readonly<Record<string, number>> = {
  [Severity.Low]: 1,
  [Severity.Medium]: 2,
  [Severity.High]: 3,
  [Severity.Critical]: 4,
};

/** Higher = worse. Unknown or missing severity ranks 0. */
export function severityRank(severity: string | null): number {
  return severity === null ? 0 : (SEVERITY_RANK[severity.toLowerCase()] ?? 0);
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  out: Map<string, string[]>;
  in: Map<string, string[]>;
}

/** Ordered node ids, entry → terminal. */
export type Route = string[];

export const routeId = (route: Route): string => route.join('>');
