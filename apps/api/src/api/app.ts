import express, { Express, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError, FilterInfo, GraphView, OverviewResponse, RoutesResponse } from '@backslash/api-contract';
import {
  FilterRegistry,
  Graph,
  Route,
  RouteFilter,
  buildOverview,
  expandNode,
  queryRoutes,
  routeId,
  toView,
  viewOfRoutes,
} from '@backslash/graph-engine';
import { NeighborsQuery, OverviewQuery, RoutesQuery } from './query-schemas';

export interface AppDeps {
  graph: Graph;
  routes: Route[];
  registry: FilterRegistry;
}

const badRequest = (res: Response, error: ZodError): void => {
  const body: ApiError = { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  res.status(400).json(body);
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
    const body: GraphView = toView(graph, graph.nodes.keys(), graph.edges);
    res.json(body);
  });

  app.get('/graph/overview', (req, res) => {
    const query = OverviewQuery.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const { nodes, edges, truncated } = buildOverview(graph, routes, query.data.maxNodes);
    const body: OverviewResponse = { nodes, edges, meta: { totalNodes: graph.nodes.size, shownNodes: nodes.length, truncated } };
    res.json(body);
  });

  app.get('/nodes/:id/neighbors', (req, res) => {
    const query = NeighborsQuery.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const view = expandNode(graph, req.params.id, query.data.direction);
    if (view === undefined) {
      const body: ApiError = { error: `Unknown node: ${req.params.id}` };
      res.status(404).json(body);
      return;
    }
    const body: GraphView = view;
    res.json(body);
  });

  app.get('/filters', (_req, res) => {
    const body: FilterInfo[] = registry.list().map(({ name, description }) => ({ name, description }));
    res.json(body);
  });

  app.get('/routes', (req, res) => {
    const query = RoutesQuery.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const { filters: names, match } = query.data;

    const unknown = names.filter((n) => registry.get(n) === undefined);
    if (unknown.length > 0) {
      const body: ApiError = { error: `Unknown filter(s): ${unknown.join(', ')}`, validFilters: registry.names() };
      res.status(400).json(body);
      return;
    }
    const filters = names.map((n) => registry.get(n)).filter((f): f is RouteFilter => f !== undefined);

    const matched = queryRoutes(graph, routes, filters, match);
    const body: RoutesResponse = {
      ...viewOfRoutes(graph, matched),
      routes: matched.map((r) => ({ id: routeId(r), nodes: r })),
      meta: { filters: names, match, totalRoutes: routes.length, matchedRoutes: matched.length },
    };
    res.json(body);
  });

  app.use((req, res) => {
    const body: ApiError = { error: `Not found: ${req.method} ${req.path}` };
    res.status(404).json(body);
  });

  // Express recognises an error handler by its 4-parameter arity, so _next must stay.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    const body: ApiError = { error: 'Internal server error' };
    res.status(500).json(body);
  });

  return app;
}
