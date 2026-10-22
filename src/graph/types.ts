export const NodeKind = { Service: 'service', Rds: 'rds', Sqs: 'sqs' } as const;

/** Kinds that count as a data sink. `sqs` is a queue, not a sink (decision D2). */
export const SINK_KINDS: ReadonlySet<string> = new Set<string>([NodeKind.Rds]);

export const Severity = { Low: 'low', Medium: 'medium', High: 'high', Critical: 'critical' } as const;

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

export interface Vulnerability {
  file: string;
  severity: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  kind: string;
  language?: string;
  path?: string;
  publicExposed: boolean;
  vulnerabilities: Vulnerability[];
  metadata?: Record<string, unknown>;
  /** True when the node was referenced by an edge but missing from `nodes` (decision D4). */
  inferred?: boolean;
}

/** vis-network compatible edge (decision D8). */
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  out: Map<string, string[]>;
  in: Map<string, string[]>;
}

/** Ordered node ids, entry → terminal. */
export type Route = string[];

export const edgeId = (from: string, to: string): string => `${from}->${to}`;
export const routeId = (route: Route): string => route.join('>');
