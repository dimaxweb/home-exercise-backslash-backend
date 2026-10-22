import { GraphEdge } from '@backslash/api-contract';
import { useEffect, useRef } from 'react';
import { DataSet, IdType, Network, Options } from 'vis-network/standalone';
import { VisNode } from '../graph/vis-mapping';
import styles from './graph-canvas.module.css';

export const Layout = { Flow: 'flow', Force: 'force' } as const;
export type Layout = (typeof Layout)[keyof typeof Layout];

export interface Selection {
  nodes: string[];
  edges: string[];
}

export interface GraphCanvasProps {
  nodes: DataSet<VisNode>;
  edges: DataSet<GraphEdge>;
  layout: Layout;
  /** Changes when the shown graph is replaced; the canvas then fits it to the viewport. */
  fitKey: number;
  /** Nodes/edges to select and zoom to, for example a highlighted route. */
  focus: Selection | null;
  onSelectNode: (id: string | null) => void;
  onExpandNode: (id: string) => void;
}

interface PointerEvent {
  nodes: IdType[];
}

const cssVar = (name: string, fallback: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const baseOptions = (): Options => ({
  autoResize: true,
  nodes: {
    size: 14,
    font: { size: 13, face: 'system-ui, sans-serif', color: cssVar('--text', '#0f172a') },
  },
  edges: {
    arrows: { to: { enabled: true, scaleFactor: 0.55 } },
    color: { color: cssVar('--edge', '#94a3b8'), highlight: cssVar('--accent', '#2563eb') },
    width: 1.2,
    smooth: { enabled: true, type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.45 },
  },
  interaction: { hover: true, tooltipDelay: 150 },
});

const layoutOptions = (layout: Layout): Options =>
  layout === Layout.Flow
    ? {
        layout: {
          hierarchical: { enabled: true, direction: 'LR', sortMethod: 'directed', levelSeparation: 230, nodeSpacing: 70 },
        },
        physics: { enabled: false },
      }
    : {
        layout: { hierarchical: { enabled: false } },
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: { gravitationalConstant: -70, springLength: 110 },
          stabilization: { iterations: 250 },
        },
      };

export function GraphCanvas({ nodes, edges, layout, fitKey, focus, onSelectNode, onExpandNode }: GraphCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const network = useRef<Network | null>(null);
  const handlers = useRef({ onSelectNode, onExpandNode });
  const layoutRef = useRef(layout);

  useEffect(() => {
    handlers.current = { onSelectNode, onExpandNode };
  }, [onSelectNode, onExpandNode]);

  useEffect(() => {
    if (container.current === null) return undefined;
    const net = new Network(container.current, { nodes, edges }, { ...baseOptions(), ...layoutOptions(layoutRef.current) });
    net.on('click', ({ nodes: hit }: PointerEvent) => {
      const id = hit[0];
      handlers.current.onSelectNode(id === undefined ? null : String(id));
    });
    net.on('doubleClick', ({ nodes: hit }: PointerEvent) => {
      const id = hit[0];
      if (id !== undefined) handlers.current.onExpandNode(String(id));
    });
    network.current = net;
    return () => {
      net.destroy();
      network.current = null;
    };
  }, [nodes, edges]);

  useEffect(() => {
    const net = network.current;
    if (net === null) return;
    layoutRef.current = layout;
    net.setOptions(layoutOptions(layout));
    net.fit();
  }, [layout]);

  useEffect(() => {
    // Wait one frame so vis has laid out the nodes that were just added.
    const frame = requestAnimationFrame(() => network.current?.fit());
    return () => cancelAnimationFrame(frame);
  }, [fitKey]);

  useEffect(() => {
    const net = network.current;
    if (net === null) return;
    if (focus === null) {
      net.unselectAll();
      return;
    }
    net.setSelection(focus, { unselectAll: true, highlightEdges: false });
    net.fit({ nodes: focus.nodes, animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  }, [focus]);

  return (
    <div
      ref={container}
      className={styles.canvas}
      role="img"
      aria-label="Service graph. Click a node for details, double-click to expand its neighbors."
    />
  );
}
