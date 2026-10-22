import { toView, viewOfRoutes } from '../../src/view/to-view';
import { fixtureGraph } from '../../src/testing/fixtures';

const graph = fixtureGraph();

describe('toView', () => {
  it('adds vis fields, risk flags and hidden counts', () => {
    const view = toView(graph, ['web'], []);
    expect(view.edges).toEqual([]);
    expect(view.nodes).toEqual([
      expect.objectContaining({
        id: 'web',
        label: 'web',
        group: 'service',
        risk: { public: true, vulnerable: false, maxSeverity: null, sink: false },
        hidden: { in: 0, out: 2 },
      }),
    ]);
  });

  it('reports vulnerability severity and sinks', () => {
    const [api, db] = toView(graph, ['api', 'db'], []).nodes;
    expect(api.risk).toEqual({ public: false, vulnerable: true, maxSeverity: 'high', sink: false });
    expect(db.risk.sink).toBe(true);
  });

  it('includes edge endpoints, dedups edges, and counts only edges not shown as hidden', () => {
    const edge = { id: 'web->api', from: 'web', to: 'api' };
    const view = toView(graph, [], [edge, edge]);
    expect(view.edges).toEqual([edge]);
    expect(view.nodes.map((n) => [n.id, n.hidden])).toEqual([
      ['web', { in: 0, out: 1 }],
      ['api', { in: 0, out: 1 }],
    ]);
  });

  it('skips unknown node ids', () => {
    expect(toView(graph, ['ghost'], []).nodes).toEqual([]);
  });
});

describe('viewOfRoutes', () => {
  it('unions nodes and edges of the routes', () => {
    const view = viewOfRoutes(graph, [['web', 'api', 'db'], ['web', 'worker', 'queue']]);
    expect(view.nodes.map((n) => n.id)).toEqual(['web', 'api', 'db', 'worker', 'queue']);
    expect(view.edges.map((e) => e.id)).toEqual(['web->api', 'api->db', 'web->worker', 'worker->queue']);
  });
});
