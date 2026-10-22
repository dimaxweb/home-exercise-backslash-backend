import { Graph, Route } from '../graph/types';

/** The extensibility point: implement this and register it. Nothing else changes. */
export interface RouteFilter {
  /** kebab-case, used in `?filters=` */
  name: string;
  description: string;
  /** Must be pure. */
  matches(route: Route, graph: Graph): boolean;
}
