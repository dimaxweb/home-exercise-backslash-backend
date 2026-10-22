import { AppDeps } from './api/app';
import { defaultRegistry } from './filters/built-in';
import { loadGraph } from './graph/load-graph';
import { enumerateRoutes } from './graph/routes';

/** Builds everything the app needs from raw JSON. Pure, so the smoke test can reuse it. */
export function createEngine(raw: unknown): { deps: AppDeps; warnings: string[] } {
  const { graph, warnings } = loadGraph(raw);
  return { deps: { graph, routes: enumerateRoutes(graph), registry: defaultRegistry() }, warnings };
}
