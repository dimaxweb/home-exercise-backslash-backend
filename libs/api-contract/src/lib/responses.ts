import { GraphView } from './graph';

export const MatchMode = { All: 'all', Any: 'any' } as const;
export type MatchMode = (typeof MatchMode)[keyof typeof MatchMode];

export const Direction = { In: 'in', Out: 'out', Both: 'both' } as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

/** GET /graph/overview */
export interface OverviewResponse extends GraphView {
  meta: { totalNodes: number; shownNodes: number; truncated: boolean };
}

/** GET /filters */
export interface FilterInfo {
  name: string;
  description: string;
}

/** GET /routes */
export interface RoutesResponse extends GraphView {
  routes: { id: string; nodes: string[] }[];
  meta: { filters: string[]; match: MatchMode; totalRoutes: number; matchedRoutes: number };
}

/** Body of every 4xx/5xx response. `validFilters` is set only for an unknown filter. */
export interface ApiError {
  error: string;
  validFilters?: string[];
}
