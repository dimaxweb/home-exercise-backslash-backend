import { GraphNode, SINK_KINDS, severityRank } from './types';

export const isSink = (node: GraphNode): boolean => SINK_KINDS.has(node.kind);

export const isVulnerable = (node: GraphNode): boolean => node.vulnerabilities.length > 0;

/** Worst severity on the node, lower-cased, or null when it has no vulnerabilities. */
export function maxSeverity(node: GraphNode): string | null {
  let worst: string | null = null;
  for (const v of node.vulnerabilities) {
    if (worst === null || severityRank(v.severity) > severityRank(worst)) worst = v.severity.toLowerCase();
  }
  return worst;
}
