import { endsInSink, hasVulnerability, startsPublic } from '../../src/filters/built-in';
import { enumerateRoutes } from '../../src/graph/routes';
import { MatchMode, queryRoutes } from '../../src/query/query-routes';
import { fixtureGraph } from '../../src/testing/fixtures';

const graph = fixtureGraph();
const routes = enumerateRoutes(graph);

describe('queryRoutes', () => {
  it('returns all routes when no filters are given', () => {
    expect(queryRoutes(graph, routes, [], MatchMode.All)).toEqual(routes);
  });

  it('match=all keeps routes passing every filter', () => {
    expect(queryRoutes(graph, routes, [startsPublic, endsInSink, hasVulnerability], MatchMode.All)).toEqual([
      ['web', 'api', 'db'],
    ]);
  });

  it('match=any keeps routes passing at least one filter', () => {
    expect(queryRoutes(graph, routes, [startsPublic, endsInSink], MatchMode.Any)).toEqual([
      ['web', 'api', 'db'],
      ['web', 'worker', 'queue'],
    ]);
  });
});
