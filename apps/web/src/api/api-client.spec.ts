import { Direction, MatchMode } from '@backslash/api-contract';
import { ApiRequestError, fetchNeighbors, fetchOverview, fetchRoutes } from './api-client';

const respond = (status: number, body: unknown) =>
  jest.fn().mockResolvedValue({ ok: status < 400, status, json: () => Promise.resolve(body) });

describe('api-client', () => {
  afterEach(() => jest.restoreAllMocks());

  it('calls the proxied API paths', async () => {
    const fetchMock = respond(200, { nodes: [], edges: [] });
    global.fetch = fetchMock;
    await fetchOverview();
    await fetchNeighbors('a b', Direction.In);
    await fetchRoutes(['starts-public', 'ends-in-sink'], MatchMode.Any);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/graph/overview',
      '/api/nodes/a%20b/neighbors?direction=in',
      '/api/routes?filters=starts-public%2Cends-in-sink&match=any',
    ]);
  });

  it('throws ApiRequestError with the server message and validFilters', async () => {
    global.fetch = respond(400, { error: 'Unknown filter(s): bogus', validFilters: ['starts-public'] });
    const error = await fetchRoutes(['bogus'], MatchMode.All).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 400, message: 'Unknown filter(s): bogus', validFilters: ['starts-public'] });
  });
});
