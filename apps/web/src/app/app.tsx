import { Direction, MatchMode, edgeId } from '@backslash/api-contract';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchFilters, fetchNeighbors, fetchOverview, fetchRoutes } from '../api/api-client';
import { FilterBar } from '../components/filter-bar';
import { GraphCanvas, Layout, Selection } from '../components/graph-canvas';
import { Legend } from '../components/legend';
import { NodePanel } from '../components/node-panel';
import { RouteList } from '../components/route-list';
import { useGraphData } from '../graph/use-graph-data';
import styles from './app.module.css';

const ViewKind = { Overview: 'overview', Routes: 'routes' } as const;

type ViewMode = { kind: typeof ViewKind.Overview } | { kind: typeof ViewKind.Routes; filters: string[]; match: MatchMode };

const OVERVIEW: ViewMode = { kind: ViewKind.Overview };

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unexpected error';

export function App() {
  const queryClient = useQueryClient();
  const graph = useGraphData();
  const [mode, setMode] = useState<ViewMode>(OVERVIEW);
  const [layout, setLayout] = useState<Layout>(Layout.Flow);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);

  const filters = useQuery({ queryKey: ['filters'], queryFn: fetchFilters, staleTime: Infinity });
  const overview = useQuery({ queryKey: ['overview'], queryFn: fetchOverview, staleTime: Infinity });
  const criteria = mode.kind === ViewKind.Routes ? mode : null;
  const routes = useQuery({
    queryKey: ['routes', criteria?.filters, criteria?.match],
    queryFn: criteria === null ? skipToken : () => fetchRoutes(criteria.filters, criteria.match),
    staleTime: Infinity,
  });

  const active = mode.kind === ViewKind.Overview ? overview : routes;
  const { replace } = graph;

  useEffect(() => {
    if (active.data === undefined) return;
    replace(active.data);
    setSelectedId(null);
    setRouteId(null);
  }, [active.data, replace]);

  const expand = useCallback(
    async (id: string, direction: Direction) => {
      setExpanding(true);
      setExpandError(null);
      try {
        const view = await queryClient.fetchQuery({
          queryKey: ['neighbors', id, direction],
          queryFn: () => fetchNeighbors(id, direction),
          staleTime: Infinity,
        });
        graph.merge(view);
      } catch (error) {
        setExpandError(errorText(error));
      } finally {
        setExpanding(false);
      }
    },
    [queryClient, graph],
  );

  const onExpandNode = useCallback(
    (id: string) => {
      setSelectedId(id);
      void expand(id, Direction.Both);
    },
    [expand],
  );

  const focus = useMemo<Selection | null>(() => {
    const route = routes.data?.routes.find((r) => r.id === routeId);
    if (mode.kind !== ViewKind.Routes || route === undefined) return null;
    return { nodes: route.nodes, edges: route.nodes.slice(1).map((to, i) => edgeId(route.nodes[i] ?? '', to)) };
  }, [routes.data, routeId, mode.kind]);

  const selected = selectedId === null ? undefined : graph.getNode(selectedId);
  const error = filters.error ?? active.error;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.title}>Graph Query Engine</h1>
          <p className={styles.subtitle}>Train Ticket · attack paths: public entry → vulnerable service → sink</p>
        </div>
        {filters.data !== undefined && (
          <FilterBar
            filters={filters.data}
            onRun={(names, match) => setMode({ kind: ViewKind.Routes, filters: names, match })}
            onReset={() => setMode(OVERVIEW)}
          />
        )}
        <div className={styles.segmented} role="group" aria-label="Layout">
          {Object.values(Layout).map((l) => (
            <button key={l} type="button" aria-pressed={layout === l} onClick={() => setLayout(l)}>
              {l}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.status} role="status">
        {error !== null ? (
          <span className={styles.error}>
            {errorText(error)}. Is the API running? Start both with <code>npm run dev</code>.
          </span>
        ) : active.isFetching ? (
          'Loading…'
        ) : mode.kind === ViewKind.Overview && overview.data !== undefined ? (
          `Overview: ${overview.data.meta.shownNodes} of ${overview.data.meta.totalNodes} nodes${overview.data.meta.truncated ? ' (truncated)' : ''}`
        ) : routes.data !== undefined ? (
          `Routes: ${routes.data.meta.matchedRoutes} of ${routes.data.meta.totalRoutes}`
        ) : null}
        <span className={styles.counts}>
          {graph.nodeCount} nodes · {graph.edgeCount} edges on canvas
        </span>
        {expandError !== null && <span className={styles.error}>Expand failed: {expandError}</span>}
      </div>

      <main className={styles.main}>
        <div className={styles.canvas}>
          <GraphCanvas
            nodes={graph.nodes}
            edges={graph.edges}
            layout={layout}
            fitKey={graph.generation}
            focus={focus}
            onSelectNode={setSelectedId}
            onExpandNode={onExpandNode}
          />
        </div>
        <aside className={styles.side} aria-label="Details">
          {selected !== undefined ? (
            <NodePanel
              node={selected}
              hidden={graph.hiddenOf(selected.id)}
              expanding={expanding}
              onExpand={(direction) => void expand(selected.id, direction)}
            />
          ) : (
            <Legend />
          )}
          {mode.kind === ViewKind.Routes && routes.data !== undefined && (
            <RouteList response={routes.data} selectedId={routeId} onSelect={setRouteId} />
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;
