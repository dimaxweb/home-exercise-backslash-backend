import {
  ApiError,
  Direction,
  FilterInfo,
  GraphView,
  MatchMode,
  OverviewResponse,
  RoutesResponse,
} from '@backslash/api-contract';

/** Vite proxies `/api/*` to the api app and strips the prefix (decision D14). */
const API_BASE = '/api';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly validFilters?: string[],
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const fallback: ApiError = { error: `HTTP ${res.status}` };
    const body = (await res.json().catch(() => fallback)) as ApiError;
    throw new ApiRequestError(res.status, body.error, body.validFilters);
  }
  return (await res.json()) as T;
}

export const fetchOverview = (): Promise<OverviewResponse> => getJson('/graph/overview');

export const fetchFilters = (): Promise<FilterInfo[]> => getJson('/filters');

export const fetchNeighbors = (id: string, direction: Direction): Promise<GraphView> =>
  getJson(`/nodes/${encodeURIComponent(id)}/neighbors?${new URLSearchParams({ direction })}`);

export const fetchRoutes = (filters: string[], match: MatchMode): Promise<RoutesResponse> =>
  getJson(`/routes?${new URLSearchParams({ filters: filters.join(','), match })}`);
