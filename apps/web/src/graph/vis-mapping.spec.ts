import { GraphView, NodeKind, Severity, ViewNode } from '@backslash/api-contract';
import { hiddenCounts, recordDegrees, toVisNode } from './vis-mapping';

const node = (id: string, overrides: Partial<ViewNode> = {}): ViewNode => ({
  id,
  kind: NodeKind.Service,
  publicExposed: false,
  vulnerabilities: [],
  label: id,
  group: NodeKind.Service,
  risk: { public: false, vulnerable: false, maxSeverity: null, sink: false },
  hidden: { in: 0, out: 0 },
  ...overrides,
});

describe('toVisNode', () => {
  it('shows the hidden-edge badge only when something is hidden', () => {
    expect(toVisNode(node('web'), 0).label).toBe('web');
    expect(toVisNode(node('web'), 3).label).toBe('web\n+3');
  });

  it('fills vulnerable nodes by severity and thickens public borders', () => {
    const api = toVisNode(node('api', { risk: { public: true, vulnerable: true, maxSeverity: Severity.High, sink: false } }), 0);
    const plain = toVisNode(node('plain'), 0);
    expect(api.color.background).not.toBe(plain.color.background);
    expect(api.borderWidth).toBeGreaterThan(plain.borderWidth);
  });

  it('draws sinks as databases, queues as diamonds, inferred nodes dashed', () => {
    expect(toVisNode(node('db', { kind: NodeKind.Rds, risk: { public: false, vulnerable: false, maxSeverity: null, sink: true } }), 0).shape).toBe('database');
    expect(toVisNode(node('q', { kind: NodeKind.Sqs }), 0).shape).toBe('diamond');
    expect(toVisNode(node('ghost', { inferred: true }), 0).shapeProperties.borderDashes).toEqual([4, 4]);
    expect(toVisNode(node('web'), 0).shapeProperties.borderDashes).toBe(false);
  });
});

describe('degree tracking (D15)', () => {
  const edge = (from: string, to: string) => ({ id: `${from}->${to}`, from, to });

  it('records total degree the first time a node is seen and ignores later sightings', () => {
    const first: GraphView = { nodes: [node('web', { hidden: { in: 0, out: 1 } })], edges: [edge('web', 'api')] };
    const later: GraphView = { nodes: [node('web', { hidden: { in: 0, out: 2 } })], edges: [] };
    const totals = recordDegrees(recordDegrees(new Map(), first), later);
    expect(totals.get('web')).toEqual({ in: 0, out: 2 });
  });

  it('counts what is still hidden given the edges currently shown', () => {
    const totals = new Map([['web', { in: 1, out: 2 }]]);
    expect(hiddenCounts(totals, ['web'], [edge('web', 'api')]).get('web')).toBe(2);
    expect(hiddenCounts(totals, ['web'], [edge('web', 'api'), edge('web', 'worker'), edge('lb', 'web')]).get('web')).toBe(0);
  });
});
