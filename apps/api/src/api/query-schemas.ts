import { z } from 'zod';
import { Direction, MatchMode } from '@backslash/api-contract';
import { DEFAULT_MAX_NODES, MAX_NODES_LIMIT } from '@backslash/graph-engine';

export const OverviewQuery = z.object({
  maxNodes: z.coerce.number().int().min(1).max(MAX_NODES_LIMIT).default(DEFAULT_MAX_NODES),
});

export const NeighborsQuery = z.object({
  direction: z.nativeEnum(Direction).default(Direction.Both),
});

/** Accepts `?filters=a,b` and `?filters=a&filters=b`. Trims, drops empties, dedups. */
export const RoutesQuery = z.object({
  filters: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      const parts = (v === undefined ? [] : Array.isArray(v) ? v : [v]).flatMap((s) => s.split(','));
      return [...new Set(parts.map((s) => s.trim()).filter((s) => s.length > 0))];
    }),
  match: z.nativeEnum(MatchMode).default(MatchMode.All),
});
