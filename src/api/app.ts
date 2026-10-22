import express, { Express, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { FilterRegistry } from '../filters/registry';
import { RouteFilter } from '../filters/types';
import { Graph, Route, routeId } from '../graph/types';
import { queryRoutes } from '../query/query-routes';
import { expandNode } from '../view/expand';
import { buildOverview } from '../view/overview';
import { toView, viewOfRoutes } from '../view/to-view';
import { NeighborsQuery, OverviewQuery, RoutesQuery } from './query-schemas';

export interface AppDeps {
  graph: Graph;
  routes: Route[];
  registry: FilterRegistry;
}

const badRequest = (res: Response, error: ZodError): void => {
  res.status(400).json({ error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
};

export function createApp({ graph, routes, registry }: AppDeps): Express {
  const app = express();

  // The vis-network UI may be served from another origin. GET only, so no preflight handling is needed.
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/graph', (_req, res) => {
    res.json(toView(graph, graph.nodes.keys(), graph.edges));
  });

  app.get('/graph/overview', (req, res) => {
    const query = OverviewQuery.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const { nodes, edges, truncated } = buildOverview(graph, routes, query.data.maxNodes);
    res.json({ nodes, edges, meta: { totalNodes: graph.nodes.size, shownNodes: nodes.length, truncated } });
  });

  app.get('/nodes/:id/neighbors', (req, res) => {
    const query = NeighborsQuery.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const view = expandNode(graph, req.params.id, query.data.direction);
    if (view === undefined) {
      res.status(404).json({ error: `Unknown node: ${req.params.id}` });
      return;
    }
    res.json(view);
  });

  app.get('/filters', (_req, res) => {
    res.json(registry.list().map(({ name, description }) => ({ name, description })));
  });

  app.get('/routes', (req, res) => {
    const query = RoutesQuery.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const { filters: names, match } = query.data;

    const unknown = names.filter((n) => registry.get(n) === undefined);
    if (unknown.length > 0) {
      res.status(400).json({ error: `Unknown filter(s): ${unknown.join(', ')}`, validFilters: registry.names() });
      return;
    }
    const filters = names.map((n) => registry.get(n)).filter((f): f is RouteFilter => f !== undefined);

    const matched = queryRoutes(graph, routes, filters, match);
    res.json({
      ...viewOfRoutes(graph, matched),
      routes: matched.map((r) => ({ id: routeId(r), nodes: r })),
      meta: { filters: names, match, totalRoutes: routes.length, matchedRoutes: matched.length },
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
