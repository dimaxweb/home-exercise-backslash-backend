import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createEngine } from '../src/engine';
import { endsInSink, hasVulnerability, startsPublic } from '../src/filters/built-in';
import { MatchMode, queryRoutes } from '../src/query/query-routes';
import { buildOverview } from '../src/view/overview';

const raw: unknown = JSON.parse(readFileSync(path.join(__dirname, '..', 'data', 'train-ticket-be.json'), 'utf8'));
const { deps, warnings } = createEngine(raw);
const { graph, routes } = deps;
const count = (filters: Parameters<typeof queryRoutes>[2]): number =>
  queryRoutes(graph, routes, filters, MatchMode.All).length;

describe('Train Ticket data', () => {
  it('loads with the dangling assurance-service synthesized', () => {
    expect(graph.nodes.size).toBe(47);
    expect(graph.edges).toHaveLength(98);
    expect(graph.nodes.get('assurance-service')?.inferred).toBe(true);
    expect(warnings).toHaveLength(1);
  });

  it('has the expected routes and filter counts', () => {
    expect(routes).toHaveLength(222);
    expect(count([startsPublic])).toBe(6);
    expect(count([endsInSink])).toBe(30);
    expect(count([hasVulnerability])).toBe(60);
    expect(count([startsPublic, endsInSink, hasVulnerability])).toBe(0);
  });

  it('builds the risk-first overview', () => {
    const o = buildOverview(graph, routes);
    expect(o.truncated).toBe(false);
    expect(o.nodes).toHaveLength(25);
    expect(o.edges).toHaveLength(42);
    expect(o.nodes.slice(0, 2).map((n) => n.id)).toEqual(['order-service', 'auth-service']);
  });
});
