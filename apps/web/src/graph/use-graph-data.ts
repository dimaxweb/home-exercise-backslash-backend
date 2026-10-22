import { GraphEdge, GraphView, ViewNode } from '@backslash/api-contract';
import { useCallback, useMemo, useState } from 'react';
import { DataSet } from 'vis-network/standalone';
import { DegreeTotals, VisNode, hiddenCounts, recordDegrees, toVisNode } from './vis-mapping';

export interface GraphData {
  nodes: DataSet<VisNode>;
  edges: DataSet<GraphEdge>;
  /** Show exactly this view (overview, route query). */
  replace: (view: GraphView) => void;
  /** Add this view to what is shown (node expansion, D9). */
  merge: (view: GraphView) => void;
  getNode: (id: string) => ViewNode | undefined;
  hiddenOf: (id: string) => number;
  nodeCount: number;
  edgeCount: number;
  /** Increments on every replace, so the canvas knows when to re-fit. */
  generation: number;
}

interface Store {
  nodes: DataSet<VisNode>;
  edges: DataSet<GraphEdge>;
  viewNodes: Map<string, ViewNode>;
  totals: DegreeTotals;
  hidden: Map<string, number>;
}

/** Owns the vis DataSets. The network reads them directly; React only re-renders the panels. */
export function useGraphData(): GraphData {
  const [store] = useState<Store>(() => ({
    nodes: new DataSet<VisNode>(),
    edges: new DataSet<GraphEdge>(),
    viewNodes: new Map(),
    totals: new Map(),
    hidden: new Map(),
  }));
  const [version, setVersion] = useState(0);
  const [generation, setGeneration] = useState(0);

  const apply = useCallback(
    (view: GraphView, reset: boolean) => {
      if (reset) {
        store.nodes.clear();
        store.edges.clear();
        store.viewNodes.clear();
      }
      // Degree totals are facts about the graph, so they survive a reset.
      store.totals = recordDegrees(store.totals, view);
      for (const n of view.nodes) store.viewNodes.set(n.id, n);
      store.edges.update(view.edges);
      store.hidden = hiddenCounts(store.totals, store.viewNodes.keys(), store.edges.get());
      store.nodes.update([...store.viewNodes.values()].map((n) => toVisNode(n, store.hidden.get(n.id) ?? 0)));
      setVersion((v) => v + 1);
      if (reset) setGeneration((g) => g + 1);
    },
    [store],
  );

  const replace = useCallback((view: GraphView) => apply(view, true), [apply]);
  const merge = useCallback((view: GraphView) => apply(view, false), [apply]);

  return useMemo(
    () => ({
      nodes: store.nodes,
      edges: store.edges,
      replace,
      merge,
      getNode: (id: string) => store.viewNodes.get(id),
      hiddenOf: (id: string) => store.hidden.get(id) ?? 0,
      nodeCount: store.viewNodes.size,
      edgeCount: store.edges.length,
      generation,
    }),
    // `version` is the change signal for the mutable store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, replace, merge, version, generation],
  );
}
