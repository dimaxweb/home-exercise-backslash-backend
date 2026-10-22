import { Direction, ViewNode } from '@backslash/api-contract';
import styles from './panel.module.css';

export interface NodePanelProps {
  node: ViewNode;
  hidden: number;
  expanding: boolean;
  onExpand: (direction: Direction) => void;
}

const cweOf = (metadata: Record<string, unknown> | undefined): string | null => {
  const cwe = metadata?.['cwe'];
  return typeof cwe === 'string' ? cwe : null;
};

export function NodePanel({ node, hidden, expanding, onExpand }: NodePanelProps) {
  return (
    <section className={styles.section} aria-labelledby="node-title">
      <h2 id="node-title" className={styles.title}>
        {node.id}
      </h2>
      <div className={styles.badges}>
        <span className={styles.badge}>{node.kind}</span>
        {node.risk.public && <span className={`${styles.badge} ${styles.public}`}>public</span>}
        {node.risk.maxSeverity !== null && (
          <span className={`${styles.badge} ${styles.vulnerable}`}>vulnerable · {node.risk.maxSeverity}</span>
        )}
        {node.risk.sink && <span className={`${styles.badge} ${styles.sink}`}>sink</span>}
        {node.inferred && <span className={styles.badge}>inferred</span>}
      </div>

      {(node.language !== undefined || node.path !== undefined) && (
        <dl className={styles.facts}>
          {node.language !== undefined && (
            <>
              <dt>Language</dt>
              <dd>{node.language}</dd>
            </>
          )}
          {node.path !== undefined && (
            <>
              <dt>Path</dt>
              <dd className={styles.mono}>{node.path}</dd>
            </>
          )}
        </dl>
      )}

      <h3 className={styles.subtitle}>Connections</h3>
      <p className={styles.muted}>
        {hidden === 0 ? 'All edges of this node are on the canvas.' : `${hidden} edge${hidden === 1 ? '' : 's'} not shown.`}
      </p>
      <div className={styles.buttons}>
        <button type="button" onClick={() => onExpand(Direction.In)} disabled={expanding}>
          ← Callers
        </button>
        <button type="button" onClick={() => onExpand(Direction.Out)} disabled={expanding}>
          Callees →
        </button>
        <button type="button" onClick={() => onExpand(Direction.Both)} disabled={expanding}>
          Both
        </button>
      </div>

      {node.vulnerabilities.length > 0 && (
        <>
          <h3 className={styles.subtitle}>Vulnerabilities ({node.vulnerabilities.length})</h3>
          <ul className={styles.vulns}>
            {node.vulnerabilities.map((v, i) => {
              const cwe = cweOf(v.metadata);
              return (
                // Vulnerabilities have no id; file + index is stable for one node.
                <li key={`${v.file}#${i}`} className={styles.vuln}>
                  <span className={`${styles.badge} ${styles.vulnerable}`}>{v.severity}</span>
                  <p>{v.message.trim()}</p>
                  {cwe !== null && <p className={styles.muted}>{cwe}</p>}
                  <p className={`${styles.mono} ${styles.muted}`}>{v.file}</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
