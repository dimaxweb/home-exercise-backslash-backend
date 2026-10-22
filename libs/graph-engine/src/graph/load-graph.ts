import { z } from 'zod';
import { Graph, GraphEdge, GraphNode, NodeKind, edgeId } from './types';

const RawVulnerability = z.object({
  file: z.string(),
  severity: z.string(),
  message: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

const RawNode = z.object({
  name: z.string().min(1),
  kind: z.string().min(1),
  language: z.string().optional(),
  path: z.string().optional(),
  publicExposed: z.boolean().optional(),
  vulnerabilities: z.array(RawVulnerability).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const RawEdge = z.object({
  from: z.string().min(1),
  to: z.union([z.string().min(1), z.array(z.string().min(1))]),
});

const RawGraphSchema = z.object({ nodes: z.array(RawNode), edges: z.array(RawEdge) });

export interface LoadResult {
  graph: Graph;
  warnings: string[];
}

/** Validates raw JSON and normalizes its quirks (spec §4) into a Graph. Pure: warnings are returned, not logged. */
export function loadGraph(raw: unknown): LoadResult {
  const parsed = RawGraphSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Invalid graph data: ${parsed.error.message}`);

  const warnings: string[] = [];
  const nodes = new Map<string, GraphNode>();
  for (const n of parsed.data.nodes) {
    if (nodes.has(n.name)) {
      warnings.push(`Duplicate node "${n.name}" ignored`);
      continue;
    }
    nodes.set(n.name, {
      id: n.name,
      kind: n.kind,
      language: n.language,
      path: n.path,
      publicExposed: n.publicExposed ?? false,
      vulnerabilities: n.vulnerabilities ?? [],
      metadata: n.metadata,
    });
  }

  const ensureNode = (id: string): void => {
    if (nodes.has(id)) return;
    nodes.set(id, { id, kind: NodeKind.Service, publicExposed: false, vulnerabilities: [], inferred: true });
    warnings.push(`Node "${id}" is referenced by an edge but not declared; synthesized as an inferred service`);
  };

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const e of parsed.data.edges) {
    const targets = Array.isArray(e.to) ? e.to : [e.to];
    for (const to of targets) {
      const id = edgeId(e.from, to);
      if (seen.has(id)) continue;
      seen.add(id);
      ensureNode(e.from);
      ensureNode(to);
      edges.push({ id, from: e.from, to });
    }
  }

  const out = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const id of nodes.keys()) {
    out.set(id, []);
    incoming.set(id, []);
  }
  for (const e of edges) {
    out.get(e.from)?.push(e.to);
    incoming.get(e.to)?.push(e.from);
  }

  return { graph: { nodes, edges, out, in: incoming }, warnings };
}
