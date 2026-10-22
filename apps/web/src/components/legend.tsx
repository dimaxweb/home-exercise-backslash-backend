import { Severity } from '@backslash/api-contract';
import { CSSProperties } from 'react';
import { Palette } from '../graph/vis-mapping';
import styles from './panel.module.css';

const ITEMS: { label: string; swatch: CSSProperties }[] = [
  { label: 'vulnerable · high', swatch: { background: Palette.severity[Severity.High] } },
  { label: 'vulnerable · medium', swatch: { background: Palette.severity[Severity.Medium] } },
  {
    label: 'public entry point (thick border)',
    swatch: { background: Palette.neutral, border: `3px solid ${Palette.publicBorder}` },
  },
  { label: 'sink (database)', swatch: { background: Palette.sink, borderRadius: 3 } },
  { label: 'queue', swatch: { background: Palette.neutral, transform: 'rotate(45deg)', borderRadius: 2 } },
  { label: 'inferred (missing from the data)', swatch: { background: 'transparent', border: `2px dashed ${Palette.border}` } },
];

export function Legend() {
  return (
    <section className={styles.section} aria-labelledby="legend-title">
      <h2 id="legend-title" className={styles.title}>
        Reading the graph
      </h2>
      <p className={styles.muted}>
        The overview shows vulnerable services, public entry points, sinks, and the routes through vulnerable services.
        Click a node for details. Double-click it to expand its neighbors. <code>+n</code> on a label counts its edges
        that are not shown yet.
      </p>
      <ul className={styles.legend}>
        {ITEMS.map((item) => (
          <li key={item.label}>
            <span className={styles.swatch} style={item.swatch} aria-hidden="true" />
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
