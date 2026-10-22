import { MatchMode, RoutesResponse } from '@backslash/api-contract';
import styles from './panel.module.css';

export interface RouteListProps {
  response: RoutesResponse;
  selectedId: string | null;
  onSelect: (routeId: string | null) => void;
}

export function RouteList({ response, selectedId, onSelect }: RouteListProps) {
  const { meta, routes } = response;
  return (
    <section className={styles.section} aria-labelledby="routes-title">
      <h2 id="routes-title" className={styles.title}>
        {meta.matchedRoutes} of {meta.totalRoutes} routes
      </h2>
      <p className={styles.muted}>
        {meta.filters.length === 0
          ? 'No filters, so every route is listed.'
          : meta.filters.join(meta.match === MatchMode.All ? ' AND ' : ' OR ')}
      </p>
      {routes.length === 0 ? (
        <p className={styles.empty}>
          No route matches. Try <code>match=any</code> to see each condition separately. For example, no public
          entry point on this data reaches a vulnerable service.
        </p>
      ) : (
        <ol className={styles.routes}>
          {routes.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`${styles.route} ${r.id === selectedId ? styles.selected : ''}`}
                aria-pressed={r.id === selectedId}
                onClick={() => onSelect(r.id === selectedId ? null : r.id)}
              >
                {r.nodes.join(' → ')}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
