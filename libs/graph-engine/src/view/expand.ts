import { Direction, GraphView } from '@backslash/api-contract';
import { Graph, GraphEdge, edgeId } from '../graph/types';
import { toView } from './to-view';

export { Direction } from '@backslash/api-contract';

/** One hop around a node (decision D9: stateless, the client merges by id). Undefined when the node is unknown. */
export function expandNode(graph: Graph, id: string, direction: Direction): GraphView | undefined {
  if (!graph.nodes.has(id)) return undefined;
  const edges: GraphEdge[] = [];
  if (direction !== Direction.In) {
    for (const to of graph.out.get(id) ?? []) edges.push({ id: edgeId(id, to), from: id, to });
  }
  if (direction !== Direction.Out) {
    for (const from of graph.in.get(id) ?? []) edges.push({ id: edgeId(from, id), from, to: id });
  }
  return toView(graph, [id], edges);
}
