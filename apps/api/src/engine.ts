import { AppDeps } from './api/app';
import { defaultRegistry, enumerateRoutes, loadGraph } from '@backslash/graph-engine';

/** Builds everything the app needs from raw JSON. Pure, so the smoke test can reuse it. */
export function createEngine(raw: unknown): { deps: AppDeps; warnings: string[] } {
  const { graph, warnings } = loadGraph(raw);
  return { deps: { graph, routes: enumerateRoutes(graph), registry: defaultRegistry() }, warnings };
}
