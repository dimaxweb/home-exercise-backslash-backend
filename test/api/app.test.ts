import request from 'supertest';
import { createApp } from '../../src/api/app';
import { defaultRegistry } from '../../src/filters/built-in';
import { enumerateRoutes } from '../../src/graph/routes';
import { fixtureGraph } from '../fixtures';

const graph = fixtureGraph();
const app = createApp({ graph, routes: enumerateRoutes(graph), registry: defaultRegistry() });

describe('API', () => {
  it('GET /health', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /graph returns the full graph in vis shape', async () => {
    const res = await request(app).get('/graph').expect(200);
    expect(res.body.nodes).toHaveLength(6);
    expect(res.body.edges).toHaveLength(4);
    expect(res.body.edges[0]).toEqual({ id: 'web->api', from: 'web', to: 'api' });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  describe('GET /graph/overview', () => {
    it('returns the risk view with meta', async () => {
      const res = await request(app).get('/graph/overview').expect(200);
      expect(res.body.meta).toEqual({ totalNodes: 6, shownNodes: 3, truncated: false });
      expect(res.body.nodes[0]).toMatchObject({ id: 'api', label: 'api', group: 'service' });
    });

    it('honours maxNodes', async () => {
      const res = await request(app).get('/graph/overview?maxNodes=2').expect(200);
      expect(res.body.meta).toEqual({ totalNodes: 6, shownNodes: 2, truncated: true });
    });

    it.each(['0', '501', 'abc'])('400 for maxNodes=%s', async (v) => {
      const res = await request(app).get(`/graph/overview?maxNodes=${v}`).expect(400);
      expect(res.body.error).toMatch(/maxNodes/);
    });
  });

  describe('GET /nodes/:id/neighbors', () => {
    it('expands both directions by default', async () => {
      const res = await request(app).get('/nodes/web/neighbors').expect(200);
      expect(res.body.nodes.map((n: { id: string }) => n.id)).toEqual(['web', 'api', 'worker']);
    });

    it('honours direction', async () => {
      const res = await request(app).get('/nodes/api/neighbors?direction=out').expect(200);
      expect(res.body.edges).toEqual([{ id: 'api->db', from: 'api', to: 'db' }]);
    });

    it('400 for a bad direction', async () => {
      await request(app).get('/nodes/web/neighbors?direction=sideways').expect(400);
    });

    it('404 for an unknown node', async () => {
      const res = await request(app).get('/nodes/ghost/neighbors').expect(404);
      expect(res.body.error).toMatch(/ghost/);
    });
  });

  it('GET /filters lists filters', async () => {
    const res = await request(app).get('/filters').expect(200);
    expect(res.body.map((f: { name: string }) => f.name)).toEqual(['starts-public', 'ends-in-sink', 'has-vulnerability']);
  });

  describe('GET /routes', () => {
    it('returns every route without filters', async () => {
      const res = await request(app).get('/routes').expect(200);
      expect(res.body.meta).toEqual({ filters: [], match: 'all', totalRoutes: 3, matchedRoutes: 3 });
    });

    it.each([
      '/routes?filters=starts-public,ends-in-sink',
      '/routes?filters=starts-public&filters=ends-in-sink',
    ])('ANDs filters: %s', async (url) => {
      const res = await request(app).get(url).expect(200);
      expect(res.body.routes).toEqual([{ id: 'web>api>db', nodes: ['web', 'api', 'db'] }]);
      expect(res.body.edges.map((e: { id: string }) => e.id)).toEqual(['web->api', 'api->db']);
    });

    it('ORs filters with match=any', async () => {
      const res = await request(app).get('/routes?filters=starts-public,ends-in-sink&match=any').expect(200);
      expect(res.body.meta.matchedRoutes).toBe(2);
    });

    it('400 with validFilters for an unknown filter', async () => {
      const res = await request(app).get('/routes?filters=starts-public,bogus').expect(400);
      expect(res.body.error).toMatch(/bogus/);
      expect(res.body.validFilters).toEqual(['starts-public', 'ends-in-sink', 'has-vulnerability']);
    });

    it('400 for a bad match', async () => {
      await request(app).get('/routes?match=xor').expect(400);
    });
  });

  it('404 JSON for an unknown path', async () => {
    const res = await request(app).get('/nope').expect(404);
    expect(res.body).toEqual({ error: 'Not found: GET /nope' });
  });
});
