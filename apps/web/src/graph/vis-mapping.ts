import { GraphEdge, GraphView, NodeKind, Severity, ViewNode } from '@backslash/api-contract';

export interface VisNode {
  id: string;
  label: string;
  title: string;
  shape: 'dot' | 'database' | 'diamond';
  color: { background: string; border: string; highlight: { background: string; border: string } };
  borderWidth: number;
  shapeProperties: { borderDashes: number[] | false };
}

/** Single source for node colors; the legend reads it too. */
export const Palette = {
  neutral: '#e2e8f0',
  border: '#475569',
  publicBorder: '#2563eb',
  sink: '#a78bfa',
  severity: {
    [Severity.Critical]: '#7f1d1d',
    [Severity.High]: '#dc2626',
    [Severity.Medium]: '#f59e0b',
    [Severity.Low]: '#fde047',
  } as Readonly<Record<string, string>>,
} as const;

const fillFor = (node: ViewNode): string => {
  if (node.risk.maxSeverity !== null) return Palette.severity[node.risk.maxSeverity] ?? Palette.neutral;
  return node.risk.sink ? Palette.sink : Palette.neutral;
};

const shapeFor = (node: ViewNode): VisNode['shape'] => {
  if (node.risk.sink) return 'database';
  return node.kind === NodeKind.Sqs ? 'diamond' : 'dot';
};

const tooltip = (node: ViewNode): string =>
  [
    `${node.id} (${node.kind})`,
    node.risk.public ? 'public entry point' : null,
    node.risk.maxSeverity !== null ? `vulnerable: ${node.risk.maxSeverity}` : null,
    node.risk.sink ? 'sink' : null,
    node.inferred ? 'inferred: referenced by an edge but not declared' : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

/** Server node → vis-network node. Style comes only from `risk`, `kind` and `inferred`. */
export function toVisNode(node: ViewNode, hidden: number): VisNode {
  const background = fillFor(node);
  const border = node.risk.public ? Palette.publicBorder : Palette.border;
  return {
    id: node.id,
    label: hidden > 0 ? `${node.label}\n+${hidden}` : node.label,
    title: tooltip(node),
    shape: shapeFor(node),
    color: { background, border, highlight: { background, border: '#0f172a' } },
    borderWidth: node.risk.public ? 4 : 1,
    shapeProperties: { borderDashes: node.inferred ? [4, 4] : false },
  };
}

export type DegreeTotals = ReadonlyMap<string, { in: number; out: number }>;

/**
 * D15: a node's total degree = `hidden` + the response's edges that touch it. It is recorded the first time the
 * node is seen, because that response is internally consistent.
 */
export function recordDegrees(totals: DegreeTotals, view: GraphView): DegreeTotals {
  const next = new Map(totals);
  for (const node of view.nodes) {
    if (next.has(node.id)) continue;
    const shownIn = view.edges.filter((e) => e.to === node.id).length;
    const shownOut = view.edges.filter((e) => e.from === node.id).length;
    next.set(node.id, { in: node.hidden.in + shownIn, out: node.hidden.out + shownOut });
  }
  return next;
}

/** Edges of each node that are not currently on the canvas. */
export function hiddenCounts(
  totals: DegreeTotals,
  nodeIds: Iterable<string>,
  shown: Iterable<GraphEdge>,
): Map<string, number> {
  const touching = new Map<string, number>();
  for (const e of shown) {
    touching.set(e.from, (touching.get(e.from) ?? 0) + 1);
    touching.set(e.to, (touching.get(e.to) ?? 0) + 1);
  }
  const result = new Map<string, number>();
  for (const id of nodeIds) {
    const total = totals.get(id);
    result.set(id, total === undefined ? 0 : Math.max(0, total.in + total.out - (touching.get(id) ?? 0)));
  }
  return result;
}
