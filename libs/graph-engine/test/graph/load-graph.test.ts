import { loadGraph } from '../../src/graph/load-graph';
import { rawFixture } from '../../src/testing/fixtures';

describe('loadGraph', () => {
  it('wraps a string `to` into a single edge', () => {
    const { graph } = loadGraph(rawFixture);
    expect(graph.edges).toContainEqual({ id: 'api->db', from: 'api', to: 'db' });
    expect(graph.edges).toHaveLength(4);
  });

  it('defaults publicExposed to false and vulnerabilities to []', () => {
    const worker = loadGraph(rawFixture).graph.nodes.get('worker');
    expect(worker).toMatchObject({ id: 'worker', kind: 'service', publicExposed: false, vulnerabilities: [] });
  });

  it('synthesizes a dangling edge target as an inferred service and warns', () => {
    const { graph, warnings } = loadGraph({
      nodes: [{ name: 'a', kind: 'service' }],
      edges: [{ from: 'a', to: ['ghost'] }],
    });
    expect(graph.nodes.get('ghost')).toEqual({
      id: 'ghost', kind: 'service', publicExposed: false, vulnerabilities: [], inferred: true,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('ghost');
  });

  it('deduplicates edges', () => {
    const { graph } = loadGraph({
      nodes: [{ name: 'a', kind: 'service' }, { name: 'b', kind: 'service' }],
      edges: [{ from: 'a', to: ['b', 'b'] }, { from: 'a', to: 'b' }],
    });
    expect(graph.edges).toEqual([{ id: 'a->b', from: 'a', to: 'b' }]);
  });

  it('builds out/in adjacency for every node', () => {
    const { graph } = loadGraph(rawFixture);
    expect(graph.out.get('web')).toEqual(['api', 'worker']);
    expect(graph.in.get('db')).toEqual(['api']);
    expect(graph.out.get('lonely')).toEqual([]);
    expect(graph.in.get('lonely')).toEqual([]);
  });

  it('fails fast on invalid input', () => {
    expect(() => loadGraph({ nodes: 'nope', edges: [] })).toThrow(/Invalid graph data/);
  });
});
