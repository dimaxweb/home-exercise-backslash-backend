import { enumerateRoutes } from '../../src/graph/routes';
import { buildOverview } from '../../src/view/overview';
import { fixtureGraph } from '../../src/testing/fixtures';

const graph = fixtureGraph();
const routes = enumerateRoutes(graph);

describe('buildOverview', () => {
  it('shows seeds (vulnerable > public > sink) and the vulnerable routes', () => {
    const o = buildOverview(graph, routes, 50);
    expect(o.truncated).toBe(false);
    expect(o.nodes.map((n) => n.id)).toEqual(['api', 'web', 'db']);
    expect(o.edges.map((e) => e.id)).toEqual(['web->api', 'api->db']);
    expect(o.nodes.find((n) => n.id === 'web')?.hidden).toEqual({ in: 0, out: 1 });
  });

  it('respects maxNodes by seed priority and skips routes that do not fit', () => {
    const o = buildOverview(graph, routes, 2);
    expect(o.truncated).toBe(true);
    expect(o.nodes.map((n) => n.id)).toEqual(['api', 'web']);
    expect(o.edges).toEqual([]);
    expect(o.nodes.find((n) => n.id === 'web')?.hidden).toEqual({ in: 0, out: 2 });
  });
});
