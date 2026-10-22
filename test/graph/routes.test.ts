import { loadGraph } from '../../src/graph/load-graph';
import { enumerateRoutes, routeEdges } from '../../src/graph/routes';
import { fixtureGraph } from '../fixtures';

describe('enumerateRoutes', () => {
  it('returns maximal entry→terminal paths, isolated nodes as 1-node routes', () => {
    expect(enumerateRoutes(fixtureGraph())).toEqual([
      ['web', 'api', 'db'],
      ['web', 'worker', 'queue'],
      ['lonely'],
    ]);
  });

  it('stops at a cycle instead of looping', () => {
    const { graph } = loadGraph({
      nodes: [{ name: 's', kind: 'service' }, { name: 'a', kind: 'service' }, { name: 'b', kind: 'service' }],
      edges: [{ from: 's', to: 'a' }, { from: 'a', to: 'b' }, { from: 'b', to: 'a' }],
    });
    expect(enumerateRoutes(graph)).toEqual([['s', 'a', 'b']]);
  });
});

describe('routeEdges', () => {
  it('returns the consecutive edges of a route', () => {
    expect(routeEdges(['a', 'b', 'c'])).toEqual([
      { id: 'a->b', from: 'a', to: 'b' },
      { id: 'b->c', from: 'b', to: 'c' },
    ]);
    expect(routeEdges(['solo'])).toEqual([]);
  });
});
