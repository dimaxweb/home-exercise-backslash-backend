/** Shapes shared by the api and the web client. Types and `as const` sets only, no runtime logic. */

export const NodeKind = { Service: 'service', Rds: 'rds', Sqs: 'sqs' } as const;

export const Severity = { Low: 'low', Medium: 'medium', High: 'high', Critical: 'critical' } as const;

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

export interface NodeRisk {
  public: boolean;
  vulnerable: boolean;
  maxSeverity: string | null;
  sink: boolean;
}

/** vis-network node (decision D8) plus risk and the count of edges not in this response. */
export interface ViewNode extends GraphNode {
  label: string;
  group: string;
  risk: NodeRisk;
  hidden: { in: number; out: number };
}

export interface GraphView {
  nodes: ViewNode[];
  edges: GraphEdge[];
}
