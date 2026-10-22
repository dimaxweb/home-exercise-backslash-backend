import { Direction, expandNode } from '../../src/view/expand';
import { fixtureGraph } from '../../src/testing/fixtures';

const graph = fixtureGraph();

describe('expandNode', () => {
  it('both: node plus in and out neighbors with hidden counts', () => {
    const view = expandNode(graph, 'web', Direction.Both);
    expect(view?.edges.map((e) => e.id)).toEqual(['web->api', 'web->worker']);
    expect(view?.nodes.map((n) => [n.id, n.hidden])).toEqual([
      ['web', { in: 0, out: 0 }],
      ['api', { in: 0, out: 1 }],
      ['worker', { in: 0, out: 1 }],
    ]);
  });

  it('in: only upstream callers', () => {
    const view = expandNode(graph, 'api', Direction.In);
    expect(view?.edges.map((e) => e.id)).toEqual(['web->api']);
    expect(view?.nodes.map((n) => n.id)).toEqual(['api', 'web']);
  });

  it('out: only downstream callees', () => {
    expect(expandNode(graph, 'api', Direction.Out)?.edges.map((e) => e.id)).toEqual(['api->db']);
  });

  it('returns undefined for an unknown node', () => {
    expect(expandNode(graph, 'ghost', Direction.Both)).toBeUndefined();
  });
});
